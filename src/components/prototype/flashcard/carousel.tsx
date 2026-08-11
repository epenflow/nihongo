import { Button, type ButtonProps } from "#/components/ui/button.tsx";
import { cn } from "#/lib/utils.ts";
import { mergeProps } from "@base-ui/react";
import { Reorder, motion, type PanInfo, type Transition } from "motion/react";
import {
  createContext,
  use,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

type DivProps = ComponentPropsWithoutRef<"div">;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CarouselContextValue {
  order: string[];
  setOrder: (order: string[]) => void;
  active: number;
  count: number;
  register: (id: string) => void;
  unregister: (id: string) => void;
  next: () => void;
  prev: () => void;
  dismiss: (direction: 1 | -1) => void;
  draggable: boolean;
  axis: "x" | "y";
  stackDepth: number;
  xStep: number;
  yStep: number;
  scaleStep: number;
  opacityStep: number;
  swipeThreshold: number;
  swipeOutX: number;
  transition: Transition;
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

function useCarousel(name: string) {
  const context = use(CarouselContext);

  if (context == null) {
    throw new Error(`${name} must be used within FlashCardCarousel.Root`);
  }

  return context;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

const STACK_DEPTH = 4;
const X_STEP = 18;
const Y_STEP = 18;
const SCALE_STEP = 0.05;
const OPACITY_STEP = 0;
const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_X = 600;

const DEFAULT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 26,
};

interface FlashCardCarouselRootProps extends DivProps {
  /** When true, dismissed cards are recycled to the back of the stack instead of removed. */
  loop?: boolean;
  /** Whether the front card can be drag-dismissed. */
  draggable?: boolean;
  axis?: "x" | "y";
  /** How many cards deep the visible stack effect extends. */
  stackDepth?: number;
  /** Horizontal offset applied per stack depth. */
  xStep?: number;
  /** Vertical offset applied per stack depth. */
  yStep?: number;
  /** Scale reduction applied per stack depth. */
  scaleStep?: number;
  /** Opacity reduction applied per stack depth. */
  opacityStep?: number;
  /** Minimum drag distance (px) required to dismiss the front card. */
  swipeThreshold?: number;
  /** Distance (px) the dismissed card travels before being recycled. */
  swipeOutX?: number;
  transition?: Transition;
}

function Root({
  loop = true,
  draggable = true,
  axis = "x",
  stackDepth = STACK_DEPTH,
  xStep = X_STEP,
  yStep = Y_STEP,
  scaleStep = SCALE_STEP,
  opacityStep = OPACITY_STEP,
  swipeThreshold = SWIPE_THRESHOLD,
  swipeOutX = SWIPE_OUT_X,
  transition = DEFAULT_TRANSITION,
  className,
  ...props
}: FlashCardCarouselRootProps) {
  const [order, setOrder] = useState<string[]>([]);
  const [active, setActive] = useState(0);

  const count = order.length;

  const register = useCallback(
    (id: string) =>
      setOrder((prev) => (prev.includes(id) ? prev : [...prev, id])),
    [],
  );

  const unregister = useCallback(
    (id: string) => setOrder((prev) => prev.filter((value) => value !== id)),
    [],
  );

  /** Sends the front card to the back (loop) or removes it (no loop). */
  const dismiss = useCallback(
    (_direction: 1 | -1) => {
      setOrder((prev) => {
        const [front, ...rest] = prev;
        if (!front) return prev;
        return loop ? [...rest, front] : rest;
      });
      setActive((prev) => Math.min(prev + 1, Math.max(count - 1, 0)));
    },
    [loop, count],
  );

  /** Brings the last card in the stack back to the front. */
  const prev = useCallback(() => {
    setOrder((current) => {
      if (current.length < 2) return current;
      const last = current[current.length - 1];
      return [last, ...current.slice(0, -1)];
    });
    setActive((value) => Math.max(value - 1, 0));
  }, []);

  const next = useCallback(() => dismiss(-1), [dismiss]);

  const context = useMemo<CarouselContextValue>(
    () => ({
      order,
      setOrder,
      active,
      count,
      register,
      unregister,
      next,
      prev,
      dismiss,
      draggable,
      axis,
      stackDepth,
      xStep,
      yStep,
      scaleStep,
      opacityStep,
      swipeThreshold,
      swipeOutX,
      transition,
    }),
    [
      order,
      active,
      count,
      register,
      unregister,
      next,
      prev,
      dismiss,
      draggable,
      axis,
      stackDepth,
      xStep,
      yStep,
      scaleStep,
      opacityStep,
      swipeThreshold,
      swipeOutX,
      transition,
    ],
  );

  return (
    <CarouselContext value={context}>
      <div
        data-slot="carousel"
        className={cn("relative", className)}
        {...props}
      />
    </CarouselContext>
  );
}

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

interface ViewportProps extends Omit<
  ComponentPropsWithoutRef<typeof Reorder.Group>,
  "values" | "onReorder" | "axis"
> {
  debug?: Partial<{ guide: boolean }>;
}

function Viewport({ className, debug, ...props }: ViewportProps) {
  const { order, axis } = useCarousel("FlashCardCarousel.Viewport");

  return (
    <Reorder.Group
      as="div"
      axis={axis}
      data-slot="viewport"
      values={order}
      // Reorder.Group normally reorders `values` itself based on how much
      // dragged items overlap their siblings — but our cards are fully
      // stacked on top of each other (absolute inset-0), so every sibling
      // overlaps 100% from the first pixel of drag, and this fires a new
      // (essentially random) order every frame. We keep `drag` for the
      // gesture/physics but drive the actual stack order ourselves via
      // `dismiss()` / `prev()`, so this is intentionally a no-op.
      onReorder={() => {}}
      className={cn(
        "relative w-96 h-105 mx-auto",
        debug?.guide &&
          "before:absolute before:w-full before:h-px before:inset-1/2 before:-translate-1/2 before:bg-red-500 before:z-50 before:pointer-events-none after:absolute after:w-px after:h-full after:inset-1/2 after:-translate-1/2 after:bg-red-500 after:z-50 after:pointer-events-none border border-red-500",
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

type ItemChildren =
  | ((props: {
      dragging: boolean;
      index: number;
      isFront: boolean;
    }) => ReactNode)
  | ReactNode;

interface ItemProps extends Omit<
  ComponentPropsWithoutRef<typeof Reorder.Item>,
  "value" | "children" | "drag" | "onDragStart" | "onDragEnd"
> {
  children?: ItemChildren;
}

function Item({ children, className, style, ...props }: ItemProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);

  const {
    order,
    register,
    unregister,
    dismiss,
    draggable,
    axis,
    stackDepth,
    xStep,
    yStep,
    scaleStep,
    opacityStep,
    swipeThreshold,
    transition,
  } = useCarousel("FlashCardCarousel.Item");

  useLayoutEffect(() => {
    register(id);
    return () => unregister(id);
  }, [id, register, unregister]);

  const index = order.indexOf(id);
  const isFront = index === 0;
  const depth = Math.min(index === -1 ? stackDepth : index, stackDepth);

  const onDragStart = useCallback(() => setDragging(true), []);

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      setDragging(false);

      const offset = axis === "x" ? info.offset.x : info.offset.y;
      if (Math.abs(offset) > swipeThreshold) {
        dismiss(offset > 0 ? 1 : -1);
      }
    },
    [axis, dismiss, swipeThreshold],
  );

  const node = useMemo(
    () =>
      typeof children === "function"
        ? children({ dragging, index, isFront })
        : children,
    [children, dragging, index, isFront],
  );

  if (index === -1) return null;

  return (
    // `Reorder.Item` manages its own `zIndex` internally (to lift whichever
    // card is being dragged above its siblings), and that internal value
    // wins over anything we pass through its `style` prop — so putting our
    // depth-based zIndex there gets silently overwritten and every card
    // ends up tied at the same stacking level, with plain DOM/source order
    // deciding what's on top (always the last JSX child). Stacking order
    // needs to live on a plain wrapper element that Reorder never touches.

    <Reorder.Item
      as="div"
      value={id}
      drag={isFront && draggable ? axis : false}
      dragElastic={0.6}
      dragMomentum={false}
      // Collapses the allowed drag range to a single point, so on release
      // (when the swipe didn't clear `swipeThreshold`) the card animates
      // back to (0,0) instead of staying wherever it was dropped.
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      data-slot="item"
      data-index={index}
      data-active={isFront || undefined}
      data-dragging={dragging || undefined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        ...style,
      }}
      className={cn(
        "touch-none size-full",
        !isFront && "pointer-events-none",
        className,
      )}
      {...props}>
      <motion.div
        data-slot="item-stack"
        animate={{
          x: depth * xStep,
          y: depth * yStep,
          scale: 1 - depth * scaleStep,
          opacity: index < stackDepth ? 1 - depth * opacityStep : 0,
        }}
        transition={transition}
        className="size-full">
        {node}
      </motion.div>
    </Reorder.Item>
  );
}

// ---------------------------------------------------------------------------
// Indicator
// ---------------------------------------------------------------------------

function Indicator({ className, ...props }: DivProps) {
  const { active, count } = useCarousel("FlashCardCarousel.Indicator");
  const progress = count > 0 ? (active + 1) / count : 0;

  return (
    <div
      data-slot="indicator"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-background border border-border",
        className,
      )}
      {...props}>
      <motion.div
        data-slot="indicator-fill"
        className="absolute size-full origin-left bg-green-500"
        animate={{ scaleX: progress }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next / Prev
// ---------------------------------------------------------------------------

function Next(props: ButtonProps) {
  const { next } = useCarousel("FlashCardCarousel.Next");

  return <Button {...mergeProps(props, { onClick: next })} />;
}

function Prev(props: ButtonProps) {
  const { prev } = useCarousel("FlashCardCarousel.Prev");

  return <Button {...mergeProps(props, { onClick: prev })} />;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const FlashCardCarousel = {
  Root,
  Viewport,
  Item,
  Indicator,
  Next,
  Prev,
};
export { useCarousel as useFlashCardCarouselContext };
export type { CarouselContextValue, FlashCardCarouselRootProps };
