import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type HTMLMotionProps,
  type PanInfo,
} from "motion/react";
import React, {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * Two independent compound components, per vercel-composition-patterns:
 *
 *  - FlashCard { Root, Front, Back } — a 3D flip card. Owns its own
 *    `flipped` context. Knows nothing about carousels.
 *  - FlashCardCarousel { Root, Viewport, Item, Indicator, Next, Prev,
 *    Counter } — a bounded, looping carousel. Owns activeIndex/total/axis.
 *
 * They compose through props, not coupling: FlashCardCarousel.Item exposes
 * positioning/drag bindings via a render-prop, typed as the exact subset of
 * motion.div's props that FlashCard.Root forwards to its own motion.div —
 * so `<FlashCard.Root {...props}>` type-checks and just works.
 *
 * NOTE on react19-no-forwardref.md: uses `useContext` for portability;
 * swap in `use` from "react" if you're on React 19.
 */

// ---------------------------------------------------------------------
// Shared types / constants
// ---------------------------------------------------------------------

export type Axis = "x" | "y";

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 480;

const PALETTE = {
  bg: "#241F1B",
  face: "#F4EEE0",
  text: "#241F1B",
  muted: "#8A8074",
  border: "#43392f",
  accent: "#4F7C74",
};

// =======================================================================
// FlashCard — flip card compound component
// =======================================================================

interface FlashCardState {
  flipped: boolean;
}

interface FlashCardActions {
  flip: () => void;
  setFlipped: (flipped: boolean) => void;
}

interface FlashCardContextValue {
  state: FlashCardState;
  actions: FlashCardActions;
}

const FlashCardContext = createContext<FlashCardContextValue | null>(null);

/** Exposed so custom UI (e.g. an external "flip" button) can reach the
 * card's state/actions without being visually nested — same idea as
 * state-lift-state.md's ForwardButton example. */
export function useFlashCard(): FlashCardContextValue {
  const ctx = useContext(FlashCardContext);
  if (!ctx) {
    throw new Error("useFlashCard must be used inside <FlashCard.Root>");
  }
  return ctx;
}

export interface FlashCardRootProps extends Omit<
  HTMLMotionProps<"div">,
  "children"
> {
  children: React.ReactNode;
  /** Uncontrolled initial flip state. */
  defaultFlipped?: boolean;
  /** Controlled flip state — pass together with onFlippedChange. */
  flipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
}

function FlashCardRoot({
  children,
  style,
  defaultFlipped = false,
  flipped: controlledFlipped,
  onFlippedChange,
  ...motionProps
}: FlashCardRootProps) {
  const [uncontrolledFlipped, setUncontrolledFlipped] =
    useState(defaultFlipped);
  const isControlled = controlledFlipped !== undefined;
  const flipped = isControlled ? controlledFlipped : uncontrolledFlipped;

  const setFlipped = useCallback(
    (value: boolean) => {
      if (!isControlled) setUncontrolledFlipped(value);
      onFlippedChange?.(value);
    },
    [isControlled, onFlippedChange],
  );

  const flip = useCallback(() => setFlipped(!flipped), [flipped, setFlipped]);

  const value = useMemo<FlashCardContextValue>(
    () => ({ state: { flipped }, actions: { flip, setFlipped } }),
    [flipped, flip, setFlipped],
  );

  return (
    <FlashCardContext.Provider value={value}>
      <motion.div
        style={{ perspective: 1000, ...style }}
        onTap={() => flip()}
        {...motionProps}>
        <motion.div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
          }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}>
          {children}
        </motion.div>
      </motion.div>
    </FlashCardContext.Provider>
  );
}

const faceBaseStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  borderRadius: 12,
  background: PALETTE.face,
  color: PALETTE.text,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  textAlign: "center",
  boxShadow: "0 1px 2px rgba(0,0,0,0.35), 0 12px 24px -8px rgba(0,0,0,0.5)",
  fontFamily: "'Instrument Serif', Georgia, serif",
  fontSize: 20,
};

interface FlashCardFaceProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function FlashCardFront({ children, className, style }: FlashCardFaceProps) {
  return (
    <div className={className} style={{ ...faceBaseStyle, ...style }}>
      {children}
    </div>
  );
}

function FlashCardBack({ children, className, style }: FlashCardFaceProps) {
  return (
    <div
      className={className}
      style={{ ...faceBaseStyle, transform: "rotateY(180deg)", ...style }}>
      {children}
    </div>
  );
}

export const FlashCard = {
  Root: FlashCardRoot,
  Front: FlashCardFront,
  Back: FlashCardBack,
};

// =======================================================================
// FlashCardCarousel — bounded, looping carousel compound component
// =======================================================================

interface FlashCardCarouselState {
  activeIndex: number;
  total: number;
  axis: Axis;
}

interface FlashCardCarouselActions {
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  setAxis: (axis: Axis) => void;
  /** Internal — called by Viewport once it knows how many Items exist. */
  setTotal: (total: number) => void;
}

interface FlashCardCarouselMeta {
  maxVisible: number;
  cardWidth: number;
  cardHeight: number;
  loop: boolean;
}

interface FlashCardCarouselContextValue {
  state: FlashCardCarouselState;
  actions: FlashCardCarouselActions;
  meta: FlashCardCarouselMeta;
}

const FlashCardCarouselContext =
  createContext<FlashCardCarouselContextValue | null>(null);

export function useFlashCardCarousel(): FlashCardCarouselContextValue {
  const ctx = useContext(FlashCardCarouselContext);
  if (!ctx) {
    throw new Error(
      "FlashCardCarousel.* components must be rendered inside <FlashCardCarousel.Root>",
    );
  }
  return ctx;
}

// --- Root ---------------------------------------------------------------

export interface FlashCardCarouselRootProps {
  children: React.ReactNode;
  className?: string;
  axis?: Axis;
  loop?: boolean;
  maxVisible?: number;
  cardWidth?: number;
  cardHeight?: number;
}

function FlashCardCarouselRoot({
  children,
  className,
  axis: initialAxis = "x",
  loop = true,
  maxVisible = 3,
  cardWidth = 240,
  cardHeight = 330,
}: FlashCardCarouselRootProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [total, setTotalState] = useState(0);
  const [axis, setAxisState] = useState<Axis>(initialAxis);

  const next = useCallback(() => {
    setActiveIndex((i) => {
      if (total === 0) return 0;
      return loop ? (i + 1) % total : Math.min(i + 1, total - 1);
    });
  }, [total, loop]);

  const prev = useCallback(() => {
    setActiveIndex((i) => {
      if (total === 0) return 0;
      return loop ? (i - 1 + total) % total : Math.max(i - 1, 0);
    });
  }, [total, loop]);

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(Math.max(0, Math.min(index, Math.max(total - 1, 0))));
    },
    [total],
  );

  const setAxis = useCallback((value: Axis) => setAxisState(value), []);
  const setTotal = useCallback((value: number) => setTotalState(value), []);

  const state = useMemo<FlashCardCarouselState>(
    () => ({ activeIndex, total, axis }),
    [activeIndex, total, axis],
  );
  const actions = useMemo<FlashCardCarouselActions>(
    () => ({ next, prev, goTo, setAxis, setTotal }),
    [next, prev, goTo, setAxis, setTotal],
  );
  const meta = useMemo<FlashCardCarouselMeta>(
    () => ({ maxVisible, cardWidth, cardHeight, loop }),
    [maxVisible, cardWidth, cardHeight, loop],
  );

  const value = useMemo<FlashCardCarouselContextValue>(
    () => ({ state, actions, meta }),
    [state, actions, meta],
  );

  return (
    <FlashCardCarouselContext.Provider value={value}>
      <div
        className={className}
        style={{
          background: PALETTE.bg,
          borderRadius: 16,
          padding: "40px 24px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@400;500&display=swap');
        `}</style>
        {children}
      </div>
    </FlashCardCarouselContext.Provider>
  );
}

// --- Viewport -------------------------------------------------------------

interface InternalItemProps {
  __index?: number;
}

function FlashCardCarouselViewport({
  children,
}: {
  children: React.ReactNode;
}) {
  const { actions, meta } = useFlashCardCarousel();
  const items = useMemo(() => React.Children.toArray(children), [children]);

  React.useEffect(() => {
    actions.setTotal(items.length);
  }, [items.length, actions]);

  return (
    <div
      style={{
        position: "relative",
        width: meta.cardWidth + 40,
        height: meta.cardHeight + 40,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}>
      {items.map((child, index) =>
        isValidElement<InternalItemProps>(child)
          ? cloneElement(child, { __index: index })
          : child,
      )}
    </div>
  );
}

// --- Item -------------------------------------------------------------

/** The exact prop subset FlashCard.Root forwards to its own motion.div —
 * spread this onto whatever root element your render-prop returns. */
export type FlashCardCarouselItemRenderProps = Omit<
  HTMLMotionProps<"div">,
  "children"
>;

export interface FlashCardCarouselItemProps extends InternalItemProps {
  children: (props: FlashCardCarouselItemRenderProps) => React.ReactNode;
}

function FlashCardCarouselItem({
  __index = 0,
  children,
}: FlashCardCarouselItemProps) {
  const { state, actions, meta } = useFlashCardCarousel();
  const { activeIndex, total, axis } = state;

  const offset =
    total === 0
      ? 0
      : meta.loop
        ? (__index - activeIndex + total) % total
        : __index - activeIndex;

  const isActive = offset === 0;
  const isVisible = offset >= 0 && offset < meta.maxVisible;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-14, 14]);
  const dragFade = useTransform(
    axis === "x" ? x : y,
    [-220, 0, 220],
    [0.35, 1, 0.35],
  );

  function handleDragEnd(
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) {
    const off = axis === "x" ? info.offset.x : info.offset.y;
    const vel = axis === "x" ? info.velocity.x : info.velocity.y;
    const flung =
      Math.abs(off) > SWIPE_DISTANCE || Math.abs(vel) > SWIPE_VELOCITY;

    if (flung) {
      const dir = off >= 0 ? 1 : -1;
      const mv = axis === "x" ? x : y;
      animate(mv, dir * 700, {
        type: "spring",
        stiffness: 260,
        damping: 28,
        onComplete: () => {
          if (off < 0) actions.next();
          else actions.prev();
          x.set(0);
          y.set(0);
        },
      });
    } else {
      animate(x, 0, { type: "spring", stiffness: 420, damping: 30 });
      animate(y, 0, { type: "spring", stiffness: 420, damping: 30 });
    }
  }

  const peekY = -offset * 16;
  const scale = 1 - offset * 0.045;

  const renderProps: FlashCardCarouselItemRenderProps = {
    drag: isActive ? axis : false,
    dragMomentum: false,
    onDragEnd: isActive ? handleDragEnd : undefined,
    initial: false,
    animate: {
      y: isActive ? undefined : peekY,
      scale,
      opacity: isVisible ? 1 : 0,
    },
    transition: { type: "spring", stiffness: 300, damping: 30 },
    whileTap: isActive ? { cursor: "grabbing" } : undefined,
    style: {
      position: "absolute",
      width: meta.cardWidth,
      height: meta.cardHeight,
      zIndex: meta.maxVisible - offset,
      cursor: isActive ? "grab" : "default",
      pointerEvents: isVisible ? "auto" : "none",
      x: isActive ? x : 0,
      y: isActive ? y : peekY,
      rotate: isActive ? rotate : 0,
      opacity: isActive ? dragFade : isVisible ? 1 : 0,
      touchAction: axis === "x" ? "pan-y" : "pan-x",
    },
  };

  return <>{children(renderProps)}</>;
}

// --- Indicator -------------------------------------------------------------

function FlashCardCarouselIndicator({ className }: { className?: string }) {
  const { state, actions } = useFlashCardCarousel();

  if (state.total === 0) return null;

  return (
    <div
      className={className}
      style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: state.total }).map((_, i) => {
        const active = i === state.activeIndex;
        return (
          <button
            key={i}
            aria-label={`Go to card ${i + 1}`}
            onClick={() => actions.goTo(i)}
            style={{
              width: active ? 18 : 6,
              height: 6,
              borderRadius: 999,
              border: "none",
              padding: 0,
              background: active ? PALETTE.accent : PALETTE.border,
              cursor: "pointer",
              transition: "width 0.2s ease, background 0.2s ease",
            }}
          />
        );
      })}
    </div>
  );
}

// --- Next / Prev -------------------------------------------------------------

const navButtonStyle: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 12,
  letterSpacing: "0.04em",
  padding: "8px 16px",
  borderRadius: 999,
  border: `1px solid ${PALETTE.border}`,
  background: "transparent",
  color: PALETTE.muted,
  cursor: "pointer",
};

interface FlashCardCarouselNavButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick"
> {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

function FlashCardCarouselNext({
  onClick,
  children = "Next",
  style,
  ...rest
}: FlashCardCarouselNavButtonProps) {
  const { actions } = useFlashCardCarousel();
  return (
    <button
      {...rest}
      style={{ ...navButtonStyle, ...style }}
      onClick={(event) => {
        onClick?.(event);
        actions.next();
      }}>
      {children}
    </button>
  );
}

function FlashCardCarouselPrev({
  onClick,
  children = "Prev",
  style,
  ...rest
}: FlashCardCarouselNavButtonProps) {
  const { actions } = useFlashCardCarousel();
  return (
    <button
      {...rest}
      style={{ ...navButtonStyle, ...style }}
      onClick={(event) => {
        onClick?.(event);
        actions.prev();
      }}>
      {children}
    </button>
  );
}

// --- Counter (optional) -------------------------------------------------------------

function FlashCardCarouselCounter({ className }: { className?: string }) {
  const { state } = useFlashCardCarousel();
  if (state.total === 0) return null;
  return (
    <p
      className={className}
      style={{
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: PALETTE.muted,
        margin: 0,
      }}>
      {state.activeIndex + 1} / {state.total}
    </p>
  );
}

export const FlashCardCarousel = {
  Root: FlashCardCarouselRoot,
  Viewport: FlashCardCarouselViewport,
  Item: FlashCardCarouselItem,
  Indicator: FlashCardCarouselIndicator,
  Next: FlashCardCarouselNext,
  Prev: FlashCardCarouselPrev,
  Counter: FlashCardCarouselCounter,
};

// =======================================================================
// Demo
// =======================================================================

export default function FlashCardCarouselDemo() {
  return (
    <FlashCardCarousel.Root>
      <FlashCardCarousel.Indicator />

      <FlashCardCarousel.Viewport>
        {Array.from({ length: 10 }).map((_, index) => (
          <FlashCardCarousel.Item key={index}>
            {(props) => (
              <FlashCard.Root {...props}>
                <FlashCard.Front>Front face {index + 1}</FlashCard.Front>
                <FlashCard.Back>Back face {index + 1}</FlashCard.Back>
              </FlashCard.Root>
            )}
          </FlashCardCarousel.Item>
        ))}
      </FlashCardCarousel.Viewport>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <FlashCardCarousel.Prev onClick={() => console.log("click prev")}>
          Prev
        </FlashCardCarousel.Prev>
        <FlashCardCarousel.Counter />
        <FlashCardCarousel.Next onClick={() => console.log("click next")}>
          Next
        </FlashCardCarousel.Next>
      </div>
    </FlashCardCarousel.Root>
  );
}
