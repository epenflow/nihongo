import { Button, type ButtonProps } from "#/components/ui/button.tsx";
import { cn } from "#/lib/utils.ts";
import { mergeProps } from "@base-ui/react";
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from "react";

type Axis = "x" | "y" | "both";

// ---------------------------------------------------------------------------
// Stack / swipe configuration defaults. These stay internal constants and are
// only exposed as minimal opt-in props on `Carousel.Root` (see RootProps).
// ---------------------------------------------------------------------------
const STACK_X_DEPTH = 0; // px, horizontal offset per depth level
const STACK_Y_DEPTH = 12; // px, vertical offset per depth level
const STACK_SCALE = 0.04; // scale reduction per depth level
const MIN_SCALE = 0.82; // never shrink a visible card past this
const MAX_VISIBLE = 4; // cards beyond this depth are invisible (still mounted)
const OVERSCAN = 2; // extra cards kept mounted past MAX_VISIBLE, for Carousel.Items
const SWIPE_THRESHOLD = 80; // px
const SWIPE_VELOCITY = 500; // px/s
const EXIT_ROTATION = 15; // deg, rotation applied to a card leaving the stack
const DRAG_ROTATION = 15; // deg, max rotation while actively dragging

const STACK_SPRING = { type: "spring", stiffness: 350, damping: 30 } as const;
const EXIT_SPRING = { type: "spring", stiffness: 300, damping: 32 } as const;

interface ExitRequest {
  id: number;
  direction: 1 | -1;
}

function reorder<T>(array: T[], offset: number): T[] {
  if (array.length === 0) return array;

  const length = array.length;
  const index = ((offset % length) + length) % length;

  return [...array.slice(index), ...array.slice(0, index)];
}

// ---------------------------------------------------------------------------
// Store
//
// All frequently-changing state (data/offset/isAnimating/exitRequest) lives
// here instead of in React state on `Root`. Components read it through
// `useCarouselSelector`, which is backed by `useSyncExternalStore` and a
// per-subscriber equality check - so a component only re-renders when the
// *specific slice* it selected actually changes, not whenever any part of
// the carousel's state changes (which is what plain Context forces on every
// consumer).
// ---------------------------------------------------------------------------
interface StoreState {
  data: string[];
  offset: number;
  isAnimating: boolean;
  exitRequest: ExitRequest | null;
}

interface StoreSnapshot extends StoreState {
  order: string[];
}

class CarouselStore {
  private state: StoreState;
  private listeners = new Set<() => void>();
  private nextExitId = 1;
  private snapshot: StoreSnapshot;

  constructor(start: number) {
    this.state = {
      data: [],
      offset: start,
      isAnimating: false,
      exitRequest: null,
    };
    this.snapshot = { ...this.state, order: [] };
  }

  private emit() {
    // `order` is derived, but we compute it once per state change (not once
    // per render/selector call) and cache it on the snapshot object so
    // selectors can read `state.order` cheaply and repeatedly.
    this.snapshot = {
      ...this.state,
      order: reorder(this.state.data, this.state.offset),
    };
    for (const listener of this.listeners) listener();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): StoreSnapshot => this.snapshot;

  register(id: string) {
    if (this.state.data.includes(id)) return;
    this.state = { ...this.state, data: [...this.state.data, id] };
    this.emit();
  }

  unregister(id: string) {
    if (!this.state.data.includes(id)) return;
    this.state = {
      ...this.state,
      data: this.state.data.filter((item) => item !== id),
    };
    this.emit();
  }

  /**
   * Low-level offset mutators. These are used both as the *internal* step
   * that runs after a swipe/exit animation finishes (see `onExitComplete`
   * in `Item`) and, for `prev`, as the direct handler behind
   * `Carousel.Prev`. Because `onExitComplete` needs to be able to call
   * `next()` unconditionally (isAnimating is still true at that point - it
   * gets cleared right after), only `prev` guards against re-entrancy here;
   * `next` intentionally does not, so it must never be wired directly to a
   * user-facing control without its own guard (see `Carousel.Next` below,
   * which goes through `requestExit`).
   *
   * Both now flip `isAnimating` on. Previously only the swipe-to-exit path
   * did this, which meant `Carousel.Prev` (and the vertical-swipe shortcut)
   * had no throttling at all: mashing Prev could fire offset changes faster
   * than the stack's spring transition could visually resolve, so a card's
   * z-index (which updates instantly) would jump to the front while its
   * position/scale were still mid-flight from where they'd been a few
   * clicks ago - the "two cards both claiming to be the front card"
   * glitch. Setting `isAnimating` here, combined with the settle-complete
   * handler in `Item`, throttles navigation to one step per finished
   * transition, regardless of which control triggered it.
   */
  next = () => {
    this.state = {
      ...this.state,
      offset: this.state.offset + 1,
      isAnimating: true,
    };
    this.emit();
  };

  prev = () => {
    if (this.state.isAnimating) return;
    this.state = {
      ...this.state,
      offset: this.state.offset - 1,
      isAnimating: true,
    };
    this.emit();
  };

  /**
   * Bulk-registers item ids in one shot, used by `Carousel.Items` instead of
   * the one-by-one `register`/`unregister` a mounted `<Item>` calls. This is
   * what makes virtualization possible: an id can exist in `data` (so
   * offset/order math for the *whole* list stays correct) without a
   * corresponding `<Item>` ever mounting. No-ops if the ids are unchanged,
   * so it's safe to call every render with a fresh array reference.
   */
  setItems(ids: string[]) {
    const current = this.state.data;
    if (
      current.length === ids.length &&
      current.every((id, i) => id === ids[i])
    )
      return;
    this.state = { ...this.state, data: ids };
    this.emit();
  }

  setIsAnimating(value: boolean) {
    if (this.state.isAnimating === value) return;
    this.state = { ...this.state, isAnimating: value };
    this.emit();
  }

  /**
   * Requesting an exit (i.e. `Carousel.Next`) now guards re-entrancy here,
   * at the source, instead of relying on the *consuming* item's effect to
   * notice `isAnimating` was already true. Previously the guard lived in
   * `Item`'s effect (`if (!first || !exitRequest || isAnimating) return;`),
   * which only ran after the id-fresh `exitRequest` had already been
   * committed to the store on the *next* render/effect pass. Two clicks
   * arriving before that effect flushed (a real scenario for a fast
   * double-click, or two rapid programmatic calls) would both pass the
   * `disabled` check, and the second `requestExit` would silently
   * overwrite the first `exitRequest` with a new id before it was ever
   * consumed - the first click's animation would never fire. Setting
   * `isAnimating` synchronously, in the same state update as the request,
   * closes that window: a second call while one is pending now no-ops
   * immediately, before a re-render is even needed.
   */
  requestExit = (direction: 1 | -1) => {
    if (this.state.isAnimating) return;
    this.state = {
      ...this.state,
      exitRequest: { id: this.nextExitId++, direction },
      isAnimating: true,
    };
    this.emit();
  };

  consumeExitRequest(id: number) {
    if (this.state.exitRequest?.id !== id) return;
    this.state = { ...this.state, exitRequest: null };
    this.emit();
  }
}

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  if (a === b) return true;
  for (const key in a) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

const CarouselStoreContext = createContext<CarouselStore | null>(null);

function useCarouselStore(name: string): CarouselStore {
  const store = use(CarouselStoreContext);
  if (store == null) {
    throw new Error(`${name} component should be used within <Carousel.Root/>`);
  }
  return store;
}

/**
 * Subscribes to a derived slice of carousel state. `selector` should be
 * stable (wrap it in `useCallback` at the call site when it closes over
 * anything, e.g. an item's `id`). Only triggers a re-render when the
 * selected slice fails the equality check against the previous selection.
 */
function useCarouselSelector<T>(
  selector: (state: StoreSnapshot) => T,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): T {
  const store = useCarouselStore("useCarouselSelector");
  const lastRef = useRef<{ value: T } | null>(null);

  const getSnapshot = useCallback(() => {
    const selected = selector(store.getSnapshot());
    if (lastRef.current && equalityFn(lastRef.current.value, selected)) {
      return lastRef.current.value;
    }
    lastRef.current = { value: selected };
    return selected;
  }, [store, selector, equalityFn]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

// ---------------------------------------------------------------------------
// Config context - axis/spring/threshold values. These essentially never
// change after mount, so this stays a plain Context: cheap to consume, and
// keeping it separate from the store means config reads never get pulled
// into the store's re-render churn.
// ---------------------------------------------------------------------------
interface CarouselConfig {
  axis: Axis;
  loop: boolean;
  stackXDepth: number;
  stackYDepth: number;
  stackScale: number;
  swipeThreshold: number;
  minScale: number;
  maxVisible: number;
  exitDistance: number;
  overscan: number;
}
const CarouselConfigContext = createContext<CarouselConfig | null>(null);

function useCarouselConfig(name: string): CarouselConfig {
  const config = use(CarouselConfigContext);
  if (config == null) {
    throw new Error(`${name} component should be used within <Carousel.Root/>`);
  }
  return config;
}

/** Tracks viewport width with a single resize listener, instead of every
 * `Item` reading `window.innerWidth` on every render (a forced-layout read
 * repeated once per mounted card). */
function useViewportWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1000,
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return width;
}

interface RootProps extends ComponentProps<"div"> {
  start?: number;
  loop?: boolean;
  axis?: Axis;
  /**
   * @deprecated use `stackYDepth` instead. Kept as a fallback default for
   * `stackYDepth` so existing usages don't silently change behavior.
   */
  stackOffset?: number;
  /** px offset applied per stack depth level, horizontally (default 0) */
  stackXDepth?: number;
  /** px offset applied per stack depth level, vertically (default 12) */
  stackYDepth?: number;
  /** scale reduction applied per stack depth level (default 0.04) */
  stackScale?: number;
  /** px drag distance required before a swipe is accepted (default 80) */
  swipeThreshold?: number;
  /** smallest scale a visible stacked card can shrink to (default 0.82) */
  minScale?: number;
  /** how many cards deep the stack renders visibly (default 4) */
  maxVisible?: number;
  /**
   * Extra cards beyond `maxVisible` to keep mounted when using
   * `Carousel.Items` (default 2). Only matters for virtualized lists: it's
   * a buffer so a card's `<Item>` mounts a few steps before it becomes
   * visible instead of popping in right at the visibility boundary.
   */
  overscan?: number;
}

function Root({
  start,
  loop = true,
  axis = "both",
  stackOffset,
  stackXDepth = STACK_X_DEPTH,
  stackYDepth = stackOffset ?? STACK_Y_DEPTH,
  stackScale = STACK_SCALE,
  swipeThreshold = SWIPE_THRESHOLD,
  minScale = MIN_SCALE,
  maxVisible = MAX_VISIBLE,
  overscan = OVERSCAN,
  className,
  ...props
}: RootProps) {
  const [store] = useState(() => new CarouselStore(start ?? 0));
  const viewportWidth = useViewportWidth();

  const config = useMemo<CarouselConfig>(
    () => ({
      axis,
      loop,
      stackXDepth,
      stackYDepth,
      stackScale,
      swipeThreshold,
      minScale,
      maxVisible,
      overscan,
      exitDistance: viewportWidth * 1.2,
    }),
    [
      axis,
      loop,
      stackXDepth,
      stackYDepth,
      stackScale,
      swipeThreshold,
      minScale,
      maxVisible,
      overscan,
      viewportWidth,
    ],
  );

  return (
    <CarouselConfigContext value={config}>
      <CarouselStoreContext value={store}>
        <div
          data-slot="carousel"
          className={cn("size-full flex-col", className)}
          {...props}
        />
      </CarouselStoreContext>
    </CarouselConfigContext>
  );
}

interface ViewportProps extends ComponentProps<"div"> {}
function Viewport({ className, ...props }: ViewportProps) {
  // `Carousel.Item` renders as `absolute inset-0`, so the viewport needs to
  // be a positioned ancestor for the stack to line up correctly.
  return (
    <div
      data-slot="viewport"
      className={cn("relative size-full overflow-clip", className)}
      {...props}
    />
  );
}

interface ItemProps extends Omit<ComponentProps<"div">, "children" | "id"> {
  children: ((props: { dragging: boolean }) => ReactNode) | ReactNode;
  /**
   * Overrides the auto-generated id and skips this item's own
   * register/unregister lifecycle. Used internally by `Carousel.Items`,
   * which registers all ids in bulk up front - not meant to be passed when
   * using `<Carousel.Item>` directly.
   */
  id?: string;
}

interface ItemSelection {
  index: number;
  length: number;
  isFirst: boolean;
  isAnimating: boolean;
  exitRequest: ExitRequest | null;
}

function itemSelectionEqual(a: ItemSelection, b: ItemSelection): boolean {
  return (
    a.index === b.index &&
    a.length === b.length &&
    a.isFirst === b.isFirst &&
    a.isAnimating === b.isAnimating &&
    a.exitRequest === b.exitRequest
  );
}

function Item({
  id: idProp,
  children: render,
  className,
  ...props
}: ItemProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const store = useCarouselStore("Carousel.Item");
  const {
    axis,
    stackXDepth,
    stackYDepth,
    stackScale,
    swipeThreshold,
    minScale,
    maxVisible,
    exitDistance,
  } = useCarouselConfig("Carousel.Item");

  const [dragging, setDragging] = useState<boolean>(false);
  // Direction the active card is currently animating out towards, or null
  // when it's simply resting/settling at its stack position.
  const [exiting, setExiting] = useState<1 | -1 | null>(null);
  // After an exit completes and the item is reordered to the back of the
  // stack, we jump it there with a zero-duration transition instead of
  // animating across the screen, avoiding a visible "flying back in".
  const [skipTransition, setSkipTransition] = useState<boolean>(false);

  // Guards against `onExitComplete` running more than once for a single
  // exit. `onAnimationComplete` can fire again if the exit animation gets
  // interrupted and re-settles at the same target (e.g. a viewport resize
  // recomputing `exitDistance` mid-flight) - without this guard that would
  // double-advance the offset (`store.next()` called twice for one swipe).
  const exitHandledRef = useRef(false);

  // Live drag feedback (rotation/opacity) is driven imperatively via a
  // motion value on every drag frame, so we never touch layout/state on
  // pointer move - only the active card ever uses this.
  const dragX = useMotionValue(0);
  const dragRotate = useTransform(
    dragX,
    [-320, 0, 320],
    [-DRAG_ROTATION, 0, DRAG_ROTATION],
  );
  const dragOpacity = useTransform(
    dragX,
    [-320, -160, 0, 160, 320],
    [0.6, 0.85, 1, 0.85, 0.6],
  );

  useLayoutEffect(() => {
    if (idProp !== undefined) return; // registered in bulk by Carousel.Items
    store.register(id);
    return () => store.unregister(id);
  }, [id, idProp, store]);

  // Only the values relevant to *this* item. Non-active items get
  // `isAnimating: false` / `exitRequest: null` regardless of the store's
  // actual values, so an exit-in-progress on the active card doesn't ripple
  // a re-render through every other mounted item.
  const selector = useCallback(
    (state: StoreSnapshot): ItemSelection => {
      const index = state.order.indexOf(id);
      const isFirst = index === 0;
      return {
        index,
        length: state.order.length,
        isFirst,
        isAnimating: isFirst ? state.isAnimating : false,
        exitRequest: isFirst ? state.exitRequest : null,
      };
    },
    [id],
  );
  const {
    index,
    length,
    isFirst: first,
    isAnimating,
    exitRequest,
  } = useCarouselSelector(selector, itemSelectionEqual);

  const children = typeof render === "function" ? render({ dragging }) : render;

  const startExit = useCallback(
    (direction: 1 | -1) => {
      exitHandledRef.current = false;
      store.setIsAnimating(true);
      setExiting(direction);
    },
    [store],
  );

  // React to `Carousel.Next` being pressed. Only the active card (index 0)
  // may act on this. Consuming the request (clearing it in the store) as
  // soon as it's handled is what stops it from re-firing on whichever card
  // becomes active next after the reorder.
  //
  // Note this no longer checks `isAnimating` - `requestExit` now sets it in
  // the same store update as the request itself, so by the time this effect
  // sees a fresh `exitRequest` at all, `isAnimating` is already true and
  // would always block this from running. Re-entrancy is guarded once, at
  // the source (`store.requestExit`), instead.
  useEffect(() => {
    if (!first || !exitRequest) return;
    store.consumeExitRequest(exitRequest.id);
    startExit(exitRequest.direction);
  }, [exitRequest, first, startExit, store]);

  const onDragStart = useCallback(() => setDragging(true), []);

  const onDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      dragX.set(info.offset.x);
    },
    [dragX],
  );

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      setDragging(false);
      dragX.set(0);

      if (isAnimating) return;

      const passedX =
        axis !== "y" &&
        (Math.abs(info.offset.x) > swipeThreshold ||
          Math.abs(info.velocity.x) > SWIPE_VELOCITY);
      const passedY =
        axis !== "x" &&
        (Math.abs(info.offset.y) > swipeThreshold ||
          Math.abs(info.velocity.y) > SWIPE_VELOCITY);

      if (passedX) {
        // Tinder-style horizontal exit: animate off screen first, only
        // advance the carousel once that animation finishes.
        startExit(info.offset.x > 0 ? 1 : -1);
        return;
      }

      if (passedY) {
        // Vertical swipe keeps the simpler existing behavior.
        store.next();
      }
    },
    [axis, dragX, isAnimating, startExit, store, swipeThreshold],
  );

  const onExitComplete = useCallback(() => {
    store.next();
    setExiting(null);
    setSkipTransition(true);
    store.setIsAnimating(false);
  }, [store]);

  // Clear the "jump, don't animate" flag one frame after it was set, so any
  // *subsequent* stack movement (e.g. rising back up over time as it moves
  // toward the front) animates normally again.
  useEffect(() => {
    if (!skipTransition) return;
    const raf = requestAnimationFrame(() => setSkipTransition(false));
    return () => cancelAnimationFrame(raf);
  }, [skipTransition]);

  if (index === -1) return null;

  const drag = first && !isAnimating ? (axis === "both" ? true : axis) : false;

  const animateTarget: Record<string, number> = exiting
    ? { x: exiting * exitDistance, y: 0, scale: 1 }
    : {
        x: Math.min(index, maxVisible) * stackXDepth,
        y: Math.min(index, maxVisible) * stackYDepth,
        scale: Math.max(1 - index * stackScale, minScale),
      };

  // While actively dragging, rotation/opacity are owned by the live motion
  // values in `style` below - don't fight them with the declarative target.
  if (!dragging) {
    animateTarget.rotate = exiting ? exiting * EXIT_ROTATION : 0;
    animateTarget.opacity = exiting ? 0 : index < maxVisible ? 1 : 0;
  }

  const transition = skipTransition
    ? { duration: 0 }
    : exiting
      ? EXIT_SPRING
      : STACK_SPRING;

  return (
    <motion.div
      data-slot="item"
      drag={drag}
      dragMomentum={false}
      dragDirectionLock={axis !== "both"}
      onDragStart={onDragStart}
      onDrag={first ? onDrag : undefined}
      onDragEnd={onDragEnd}
      animate={animateTarget}
      transition={transition}
      onAnimationComplete={() => {
        if (exiting) {
          // Guard against a second completion event for the same exit (see
          // `exitHandledRef` above) double-advancing the offset.
          if (exitHandledRef.current) return;
          exitHandledRef.current = true;
          onExitComplete();
          return;
        }
        // A plain (non-exit) settle finishing - i.e. the result of
        // `Carousel.Prev`, a vertical swipe, or any other direct
        // offset change. Those now flip `isAnimating` on up front (see
        // `CarouselStore.prev`/`next`) purely to throttle rapid-fire
        // navigation; this is what releases the lock once the front
        // card has actually finished moving into place, instead of
        // leaving Prev permanently disabled or unlocking on a fixed
        // timer that could fall out of sync with the real animation.
        if (first && isAnimating) {
          store.setIsAnimating(false);
        }
      }}
      style={{
        zIndex: length - index,
        ...(dragging ? { rotate: dragRotate, opacity: dragOpacity } : {}),
      }}
      className={cn(
        "absolute top-1/2 left-1/2 -translate-1/2",
        first && !isAnimating
          ? "cursor-grab active:cursor-grabbing"
          : "pointer-events-none",
        className,
      )}
      {...mergeProps(props, { children })}
    />
  );
}

function stringArrayEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

interface ItemsProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string;
  children: (
    item: T,
    meta: { dragging: boolean; stackIndex: number },
  ) => ReactNode;
}

/**
 * Virtualized alternative to hand-writing a `<Carousel.Item>` per entry.
 * Every id in `items` is registered with the store up front (so offset/loop
 * math for the full list is correct), but only the cards within
 * `maxVisible + overscan` of the front ever get an actual `<Carousel.Item>`
 * mounted - the rest cost nothing beyond a string in an array. As the stack
 * advances, cards mount a few steps before they're visible (the `overscan`
 * buffer) and unmount only once they're already fully invisible, so there's
 * no visible pop-in/pop-out.
 *
 * Use this instead of manually mapping `<Carousel.Item>` when the list can
 * be long (dozens+) or each card's content is heavy (images, video, rich
 * subtrees).
 */
function Items<T>({ items, getKey, children }: ItemsProps<T>) {
  const store = useCarouselStore("Carousel.Items");
  const { maxVisible, overscan } = useCarouselConfig("Carousel.Items");

  const keyed = useMemo(
    () => items.map((item, index) => ({ item, key: getKey(item, index) })),
    [items, getKey],
  );
  const byKey = useMemo(
    () => new Map(keyed.map((entry) => [entry.key, entry.item])),
    [keyed],
  );
  const ids = useMemo(() => keyed.map((entry) => entry.key), [keyed]);

  useEffect(() => {
    store.setItems(ids);
  }, [ids, store]);
  useEffect(() => () => store.setItems([]), [store]);

  const renderDistance = maxVisible + overscan;
  const selector = useCallback(
    (state: StoreSnapshot) => state.order.slice(0, renderDistance),
    [renderDistance],
  );
  const visibleKeys = useCarouselSelector(selector, stringArrayEqual);

  return (
    <>
      {visibleKeys.map((key, stackIndex) => {
        const item = byKey.get(key);
        if (item === undefined) return null;
        return (
          <Item key={key} id={key}>
            {({ dragging }) => children(item, { dragging, stackIndex })}
          </Item>
        );
      })}
    </>
  );
}

const selectNextState = (state: StoreSnapshot) => ({
  length: state.order.length,
  offset: state.offset,
  isAnimating: state.isAnimating,
});
const selectPrevState = selectNextState;
const selectCounterState = (state: StoreSnapshot) => ({
  length: state.order.length,
  offset: state.offset,
});

function Next(props: ButtonProps) {
  const store = useCarouselStore("Carousel.Next");
  const { loop } = useCarouselConfig("Carousel.Next");
  const { length, offset, isAnimating } = useCarouselSelector(
    selectNextState,
    shallowEqual,
  );
  const canGoNext = length > 1 && (loop || offset < length - 1);

  return (
    <Button
      data-slot="next"
      {...mergeProps(props, {
        disabled: !canGoNext || isAnimating,
        onClick: () => store.requestExit(1),
      })}
    />
  );
}
function Prev(props: ButtonProps) {
  const store = useCarouselStore("Carousel.Prev");
  const { loop } = useCarouselConfig("Carousel.Prev");
  const { length, offset, isAnimating } = useCarouselSelector(
    selectPrevState,
    shallowEqual,
  );
  const canGoPrev = length > 1 && (loop || offset > 0);

  return (
    <Button
      data-slot="prev"
      {...mergeProps(props, {
        disabled: !canGoPrev || isAnimating,
        onClick: store.prev,
      })}
    />
  );
}
function Indicator() {
  return <div />;
}
function Counter() {
  const { length, offset } = useCarouselSelector(
    selectCounterState,
    shallowEqual,
  );
  return (
    <div>
      {offset + 1}/{length}
    </div>
  );
}

export const Carousel = {
  Root,
  Viewport,
  Item,
  Items,
  Next,
  Prev,
  Indicator,
  Counter,
};
