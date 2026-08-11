import { Button, type ButtonProps } from "#/components/ui/button.tsx";
import { cn } from "#/lib/utils.ts";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import {
  animate,
  motion,
  useMotionValue,
  type HTMLMotionProps,
  type MotionValue,
  type PanInfo,
} from "motion/react";

/** Normalized 2D direction vector, e.g. { x: -1, y: 0 } for "left". */
export interface Direction {
  x: number;
  y: number;
}

export const DEFAULT_DIRECTION: Direction = { x: -1, y: 0 };

export interface CarouselConfig {
  stackDepth: number;
  xStep: number;
  yStep: number;
  scaleStep: number;
  opacityStep: number;
  swipeThreshold: number;
  swipeOutX: number;
  rotationFactor: number;
  loop: boolean;
}

export const DEFAULT_CONFIG: CarouselConfig = {
  stackDepth: 4,
  xStep: 18,
  yStep: 18,
  scaleStep: 0.05,
  opacityStep: 0,
  swipeThreshold: 120,
  swipeOutX: 600,
  rotationFactor: 0.05,
  loop: true,
};

/**
 * Imperative handle a card hands the controller so it can drive that
 * card's exit animation from `next()` / `prev()`. Purely an internal
 * wiring detail between Item and the controller — never exposed publicly.
 */
export interface CardControls {
  layoutX: MotionValue<number>;
  opacity: MotionValue<number>;
  dismiss: (direction: Direction) => void;
}

export function rotateArray<T>(arr: T[], offset: number): T[] {
  if (arr.length === 0) return arr;
  const n = arr.length;
  const at = ((offset % n) + n) % n;
  return [...arr.slice(at), ...arr.slice(0, at)];
}

export function normalizeDirection(direction: Direction): Direction {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude === 0) return DEFAULT_DIRECTION;
  return { x: direction.x / magnitude, y: direction.y / magnitude };
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";

// ---------------------------------------------------------------------------
// Config context — the numeric tuning knobs. Only Item needs these to drive
// its Motion springs; Root just forwards whatever was passed in as props.
// ---------------------------------------------------------------------------

const CarouselConfigContext = createContext<CarouselConfig | null>(null);

export function CarouselConfigProvider({
  config,
  children,
}: {
  config: CarouselConfig;
  children: React.ReactNode;
}) {
  return (
    <CarouselConfigContext value={config}>{children}</CarouselConfigContext>
  );
}

export function useCarouselConfig(name: string): CarouselConfig {
  const context = useContext(CarouselConfigContext);
  if (!context) {
    throw new Error(`${name} must be used within FlashCardCarousel.Root`);
  }
  return context;
}

// ---------------------------------------------------------------------------
// State context — the small, public-shaped surface: "can I navigate, and
// how." This is what Next/Prev use, and what's exposed to consumers who
// want to build their own navigation UI via useFlashCardCarousel().
// ---------------------------------------------------------------------------

interface CarouselStateContextValue {
  canGoNext: boolean;
  canGoPrev: boolean;
  next: (direction?: Direction) => void;
  prev: () => void;
}

const CarouselStateContext = createContext<CarouselStateContextValue | null>(
  null,
);

export function CarouselStateProvider({
  value,
  children,
}: {
  value: CarouselStateContextValue;
  children: React.ReactNode;
}) {
  return <CarouselStateContext value={value}>{children}</CarouselStateContext>;
}

export function useCarouselState(name: string): CarouselStateContextValue {
  const context = useContext(CarouselStateContext);
  if (!context) {
    throw new Error(`${name} must be used within FlashCardCarousel.Root`);
  }
  return context;
}

/**
 * Public hook for building custom navigation controls outside of
 * `FlashCardCarousel.Next` / `.Prev` (e.g. keyboard shortcuts, a progress
 * dial). Mirrors the same {canGoNext, canGoPrev, next, prev} shape those
 * components use internally — nothing extra to learn.
 */
export function useFlashCardCarousel() {
  return useCarouselState("useFlashCardCarousel");
}

// ---------------------------------------------------------------------------
// Registry context — internal wiring between a card and the controller
// (registration, imperative dismiss handles, order lookup for index/isFront).
// Not exported from the package; consumers never see this shape, only Item
// uses it.
// ---------------------------------------------------------------------------

interface CarouselRegistryContextValue {
  order: string[];
  registerCard: (id: string) => void;
  unregisterCard: (id: string) => void;
  registerControls: (id: string, controls: CardControls) => void;
  unregisterControls: (id: string) => void;
  commitAdvance: () => void;
}

const CarouselRegistryContext =
  createContext<CarouselRegistryContextValue | null>(null);

export function CarouselRegistryProvider({
  value,
  children,
}: {
  value: CarouselRegistryContextValue;
  children: React.ReactNode;
}) {
  return (
    <CarouselRegistryContext value={value}>{children}</CarouselRegistryContext>
  );
}

export function useCarouselRegistry(
  name: string,
): CarouselRegistryContextValue {
  const context = useContext(CarouselRegistryContext);
  if (!context) {
    throw new Error(`${name} must be used within FlashCardCarousel.Root`);
  }
  return context;
}

/**
 * Single source of truth for "which cards exist, in what order, and how
 * do we move between them." Deliberately knows nothing about Motion
 * springs or drag gestures — Item owns per-card animation, this hook
 * only owns registry + navigation state. Splitting it out of Root keeps
 * Root a thin composition point instead of a god component.
 */
export function useCarouselController(config: CarouselConfig) {
  // `ids` = stable registration order, never mutated by navigation.
  const [ids, setIds] = useState<string[]>([]);
  // `offset` = how many steps forward we've rotated. Navigation only ever touches this.
  const [offset, setOffset] = useState(0);
  const controlsMapRef = useRef(new Map<string, CardControls>());
  const animatingRef = useRef(false);

  const order = useMemo(() => rotateArray(ids, offset), [ids, offset]);
  const n = ids.length;
  const canGoNext = n > 1 && (config.loop || offset < n - 1);
  const canGoPrev = n > 1 && (config.loop || offset > 0);

  const registerCard = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const unregisterCard = useCallback((id: string) => {
    setIds((prev) => prev.filter((cardId) => cardId !== id));
  }, []);

  const registerControls = useCallback((id: string, controls: CardControls) => {
    controlsMapRef.current.set(id, controls);
  }, []);

  const unregisterControls = useCallback((id: string) => {
    controlsMapRef.current.delete(id);
  }, []);

  const commitAdvance = useCallback(() => {
    setOffset((prev) =>
      config.loop ? prev + 1 : Math.min(prev + 1, Math.max(n - 1, 0)),
    );
    animatingRef.current = false;
  }, [config.loop, n]);

  const next = useCallback(
    (direction: Direction = DEFAULT_DIRECTION) => {
      if (animatingRef.current || !canGoNext) return;
      const frontId = order[0];
      const controls = frontId
        ? controlsMapRef.current.get(frontId)
        : undefined;
      if (!controls) return;
      animatingRef.current = true;
      controls.dismiss(normalizeDirection(direction));
    },
    [order, canGoNext],
  );

  const prev = useCallback(() => {
    if (animatingRef.current || !canGoPrev) return;
    const incomingId = order[order.length - 1];
    const controls = controlsMapRef.current.get(incomingId);
    // Teleport off-screen-left *before* the reorder commits, so the card
    // animates in from the left instead of jumping out of the stack.
    controls?.layoutX.jump(-config.swipeOutX);
    controls?.opacity.jump(0);
    setOffset((prevOffset) =>
      config.loop ? prevOffset - 1 : Math.max(prevOffset - 1, 0),
    );
  }, [order, canGoPrev, config.loop, config.swipeOutX]);

  return {
    order,
    canGoNext,
    canGoPrev,
    next,
    prev,
    // Grouped separately from the state above: these are only ever
    // consumed by Item, never by Next/Prev or outside consumers.
    registry: {
      registerCard,
      unregisterCard,
      registerControls,
      unregisterControls,
      commitAdvance,
    },
  };
}

interface FlashCardCarouselRootProps
  extends ComponentProps<"div">, Partial<CarouselConfig> {
  onFrontChange?: (id: string | undefined) => void;
}

function FlashCardCarouselRoot({
  className,
  children,
  stackDepth,
  xStep,
  yStep,
  scaleStep,
  opacityStep,
  swipeThreshold,
  swipeOutX,
  rotationFactor,
  loop,
  onFrontChange,
  ...props
}: FlashCardCarouselRootProps) {
  const config: CarouselConfig = {
    stackDepth: stackDepth ?? DEFAULT_CONFIG.stackDepth,
    xStep: xStep ?? DEFAULT_CONFIG.xStep,
    yStep: yStep ?? DEFAULT_CONFIG.yStep,
    scaleStep: scaleStep ?? DEFAULT_CONFIG.scaleStep,
    opacityStep: opacityStep ?? DEFAULT_CONFIG.opacityStep,
    swipeThreshold: swipeThreshold ?? DEFAULT_CONFIG.swipeThreshold,
    swipeOutX: swipeOutX ?? DEFAULT_CONFIG.swipeOutX,
    rotationFactor: rotationFactor ?? DEFAULT_CONFIG.rotationFactor,
    loop: loop ?? DEFAULT_CONFIG.loop,
  };

  const { order, canGoNext, canGoPrev, next, prev, registry } =
    useCarouselController(config);

  useEffect(() => {
    onFrontChange?.(order[0]);
  }, [order, onFrontChange]);

  return (
    <CarouselConfigProvider config={config}>
      <CarouselStateProvider value={{ canGoNext, canGoPrev, next, prev }}>
        <CarouselRegistryProvider value={{ order, ...registry }}>
          <div
            data-slot="carousel-root"
            className={cn("relative", className)}
            {...props}>
            {children}
          </div>
        </CarouselRegistryProvider>
      </CarouselStateProvider>
    </CarouselConfigProvider>
  );
}

function FlashCardCarouselViewport({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="carousel-viewport"
      className={cn("relative w-96 h-105", className)}
      {...props}>
      {children}
    </div>
  );
}

function FlashCardCarouselItem({
  className,
  children,
  ...props
}: HTMLMotionProps<"div">) {
  const id = useId();
  const config = useCarouselConfig("FlashCardCarousel.Item");
  const {
    order,
    registerCard,
    unregisterCard,
    registerControls,
    unregisterControls,
    commitAdvance,
  } = useCarouselRegistry("FlashCardCarousel.Item");
  const { next } = useCarouselState("FlashCardCarousel.Item");

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    registerCard(id);
    return () => unregisterCard(id);
  }, [id, registerCard, unregisterCard]);

  const index = order.indexOf(id);
  const isFront = index === 0;

  // Layout layer: stack position (x/y/scale/opacity), driven imperatively so
  // it can be "jumped" instantly during prev()'s teleport-then-animate trick.
  const layoutX = useMotionValue(0);
  const layoutY = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(1);

  // Drag layer: kept separate so drag transforms never fight the layout animation.
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const rotateZ = useMotionValue(0);

  useEffect(() => {
    return dragX.on("change", (v) => rotateZ.set(v * config.rotationFactor));
  }, [dragX, rotateZ, config.rotationFactor]);

  useEffect(() => {
    if (index === -1) return;
    const depth = Math.min(index, config.stackDepth);
    const anims = [
      animate(layoutX, depth * config.xStep, {
        type: "spring",
        stiffness: 260,
        damping: 28,
      }),
      animate(layoutY, depth * config.yStep, {
        type: "spring",
        stiffness: 260,
        damping: 28,
      }),
      animate(scale, 1 - depth * config.scaleStep, {
        type: "spring",
        stiffness: 260,
        damping: 28,
      }),
      animate(
        opacity,
        index < config.stackDepth ? 1 - depth * config.opacityStep : 0,
        { duration: 0.3 },
      ),
    ];
    return () => anims.forEach((a) => a.stop());
  }, [index, config, layoutX, layoutY, scale, opacity]);

  const dismiss = useCallback(
    (direction: Direction) => {
      // Fly out in whatever direction the user actually dragged (or the
      // caller-supplied direction for button-triggered dismissal).
      animate(dragX, direction.x * config.swipeOutX, {
        duration: 0.3,
        ease: [0.4, 0, 1, 1],
        onComplete: () => {
          dragX.jump(0);
          dragY.jump(0);
          rotateZ.jump(0);
          commitAdvance();
        },
      });
      animate(dragY, direction.y * config.swipeOutX, {
        duration: 0.3,
        ease: [0.4, 0, 1, 1],
      });
      animate(opacity, 0, { duration: 0.25 });
    },
    [dragX, dragY, opacity, rotateZ, config.swipeOutX, commitAdvance],
  );

  useEffect(() => {
    if (index === -1) return;
    registerControls(id, { layoutX, opacity, dismiss });
    return () => unregisterControls(id);
  }, [
    id,
    index,
    layoutX,
    opacity,
    dismiss,
    registerControls,
    unregisterControls,
  ]);

  const handleDragEnd = useCallback(
    (_: PointerEvent, info: PanInfo) => {
      // Delay clearing data-dragging by a frame so the synthetic click that
      // follows pointerup on drag-release is still blocked by pointer-events-none.
      requestAnimationFrame(() => setIsDragging(false));

      const distance = Math.hypot(info.offset.x, info.offset.y);
      if (distance > config.swipeThreshold) {
        next({
          x: info.offset.x / distance,
          y: info.offset.y / distance,
        });
      }
      // Below threshold: dragConstraints + dragElastic already snap it back to (0,0).
    },
    [config.swipeThreshold, next],
  );

  if (index === -1) return null;

  return (
    <motion.div
      data-slot="carousel-item"
      data-index={index}
      className={cn("absolute inset-1/2 -translate-1/2 w-96 h-105", className)}
      style={{
        x: layoutX,
        y: layoutY,
        scale,
        opacity,
        zIndex: order.length - index,
        pointerEvents: isFront ? "auto" : "none",
      }}
      {...props}>
      <motion.div
        data-dragging={isDragging}
        className="w-full h-full group/dragging"
        style={{ x: dragX, y: dragY, rotate: rotateZ }}
        drag={isFront}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.6}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}>
        {children}
      </motion.div>
    </motion.div>
  );
}

function FlashCardCarouselNext({
  children,
  onClick,
  disabled,
  ...props
}: ButtonProps) {
  const { next, canGoNext } = useCarouselState("FlashCardCarousel.Next");
  return (
    <Button
      size="icon"
      disabled={disabled ?? !canGoNext}
      onClick={(e) => {
        onClick?.(e);
        next();
      }}
      {...props}>
      {children ?? (
        <>
          <span className="sr-only">Next</span>
          <ArrowRightIcon />
        </>
      )}
    </Button>
  );
}

function FlashCardCarouselPrev({
  children,
  onClick,
  disabled,
  ...props
}: ButtonProps) {
  const { prev, canGoPrev } = useCarouselState("FlashCardCarousel.Prev");
  return (
    <Button
      size="icon"
      disabled={disabled ?? !canGoPrev}
      onClick={(e) => {
        onClick?.(e);
        prev();
      }}
      {...props}>
      {children ?? (
        <>
          <span className="sr-only">Previous</span>
          <ArrowLeftIcon />
        </>
      )}
    </Button>
  );
}

export const FlashCardCarousel = {
  Root: FlashCardCarouselRoot,
  Viewport: FlashCardCarouselViewport,
  Item: FlashCardCarouselItem,
  Next: FlashCardCarouselNext,
  Prev: FlashCardCarouselPrev,
};
