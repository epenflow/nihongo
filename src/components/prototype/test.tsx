import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * SwipeStack — compound component.
 *
 * Structure follows the vercel-composition-patterns skill:
 *  - SwipeStack.Provider owns state and exposes a { state, actions, meta }
 *    context (see state-context-interface.md). It's the only place that
 *    knows *how* the deck is managed — swap it out and every other piece
 *    below keeps working unchanged (state-decouple-implementation.md).
 *  - Every other piece is a leaf that reads from context instead of
 *    taking config through boolean/callback props
 *    (architecture-avoid-boolean-props.md).
 *  - Layout is composed with children, not renderX props
 *    (patterns-children-over-render-props.md).
 *
 * NOTE on react19-no-forwardref.md: that rule says `use()` instead of
 * `useContext()`, but only applies "React 19+ only — skip if on 18".
 * This file uses `useContext` for portability; swap in `use` from
 * "react" if your app is on React 19.
 */

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export type Axis = "x" | "y";

export interface Photo {
  src: string;
  label: string;
}

interface DeckItem extends Photo {
  id: number;
}

interface SwipeStackState {
  deck: DeckItem[];
  axis: Axis;
  swipeCount: number;
}

interface SwipeStackActions {
  swipe: () => void;
  setAxis: (axis: Axis) => void;
}

interface SwipeStackMeta {
  maxVisible: number;
  cardWidth: number;
  cardHeight: number;
  totalPhotos: number;
}

interface SwipeStackContextValue {
  state: SwipeStackState;
  actions: SwipeStackActions;
  meta: SwipeStackMeta;
}

// ---------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------

const SwipeStackContext = createContext<SwipeStackContextValue | null>(null);

function useSwipeStackContext(): SwipeStackContextValue {
  const ctx = useContext(SwipeStackContext);
  if (!ctx) {
    throw new Error(
      "SwipeStack.* components must be rendered inside <SwipeStack.Provider>",
    );
  }
  return ctx;
}

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 480;

let uid = 0;
function makeDeck(photos: Photo[]): DeckItem[] {
  // Repeat the source photos so the ring buffer has more entries than
  // maxVisible — that guarantees a swiped card fully unmounts (and its
  // drag offset resets) before it cycles back to the top.
  return [...photos, ...photos].map((p) => ({ ...p, id: uid++ }));
}

// ---------------------------------------------------------------------
// Provider — owns state, exposes { state, actions, meta }
// ---------------------------------------------------------------------

interface SwipeStackProviderProps {
  photos: Photo[];
  maxVisible?: number;
  cardWidth?: number;
  cardHeight?: number;
  children: React.ReactNode;
}

function SwipeStackProvider({
  photos,
  maxVisible = 3,
  cardWidth = 240,
  cardHeight = 330,
  children,
}: SwipeStackProviderProps) {
  const [deck, setDeck] = useState<DeckItem[]>(() => makeDeck(photos));
  const [axis, setAxis] = useState<Axis>("x");
  const [swipeCount, setSwipeCount] = useState(0);

  const swipe = useCallback(() => {
    setDeck((prev) => [...prev.slice(1), prev[0]]);
    setSwipeCount((c) => c + 1);
  }, []);

  const value = useMemo<SwipeStackContextValue>(
    () => ({
      state: { deck, axis, swipeCount },
      actions: { swipe, setAxis },
      meta: { maxVisible, cardWidth, cardHeight, totalPhotos: photos.length },
    }),
    [
      deck,
      axis,
      swipeCount,
      swipe,
      maxVisible,
      cardWidth,
      cardHeight,
      photos.length,
    ],
  );

  return (
    <SwipeStackContext.Provider value={value}>
      {children}
    </SwipeStackContext.Provider>
  );
}

// ---------------------------------------------------------------------
// Root — the visual frame. No state, just layout + font import.
// ---------------------------------------------------------------------

function SwipeStackRoot({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#241F1B",
        borderRadius: 16,
        padding: "40px 24px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@400;500&display=swap');
      `}</style>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------
// Header / Title / Counter — composed by the consumer, not baked in
// ---------------------------------------------------------------------

function SwipeStackHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "center" }}>{children}</div>;
}

function SwipeStackTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontStyle: "italic",
        fontSize: 22,
        color: "#F4EEE0",
        margin: 0,
      }}>
      {children}
    </p>
  );
}

function SwipeStackCounter() {
  const {
    state: { swipeCount },
    meta: { totalPhotos },
  } = useSwipeStackContext();
  const position = swipeCount % totalPhotos;

  return (
    <p
      style={{
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#8A8074",
        margin: "6px 0 0",
      }}>
      card {position + 1} of {totalPhotos} · swiped {swipeCount} times
    </p>
  );
}

// ---------------------------------------------------------------------
// Deck — reads deck/meta from context, renders one Card per visible item
// ---------------------------------------------------------------------

function SwipeStackDeck() {
  const {
    state: { deck },
    meta: { maxVisible, cardWidth, cardHeight },
  } = useSwipeStackContext();

  const visible = deck.slice(0, maxVisible);

  return (
    <div
      style={{
        position: "relative",
        width: cardWidth + 40,
        height: cardHeight + 40,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}>
      {visible
        .map((photo, position) => ({ photo, position }))
        .reverse()
        .map(({ photo, position }) => (
          <SwipeStackCard key={photo.id} photo={photo} position={position} />
        ))}
    </div>
  );
}

interface SwipeStackCardProps {
  photo: DeckItem;
  position: number;
}

// photo/position are item-specific data (unavoidable for list rendering),
// everything else — axis, dimensions, maxVisible, the swipe action — comes
// from context instead of being drilled down through props.
function SwipeStackCard({ photo, position }: SwipeStackCardProps) {
  const {
    state: { axis },
    actions: { swipe },
    meta: { maxVisible, cardWidth, cardHeight },
  } = useSwipeStackContext();

  const isTop = position === 0;
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
    const offset = axis === "x" ? info.offset.x : info.offset.y;
    const velocity = axis === "x" ? info.velocity.x : info.velocity.y;
    const flung =
      Math.abs(offset) > SWIPE_DISTANCE || Math.abs(velocity) > SWIPE_VELOCITY;

    if (flung) {
      const dir = offset >= 0 ? 1 : -1;
      const mv = axis === "x" ? x : y;
      animate(mv, dir * 700, {
        type: "spring",
        stiffness: 260,
        damping: 28,
        onComplete: swipe,
      });
    } else {
      animate(x, 0, { type: "spring", stiffness: 420, damping: 30 });
      animate(y, 0, { type: "spring", stiffness: 420, damping: 30 });
    }
  }

  const peekY = -position * 16;
  const scale = 1 - position * 0.045;

  return (
    <motion.div
      drag={isTop ? axis : false}
      dragMomentum={false}
      onDragEnd={isTop ? handleDragEnd : undefined}
      initial={false}
      animate={{ y: isTop ? undefined : peekY, scale, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        position: "absolute",
        width: cardWidth,
        height: cardHeight,
        zIndex: maxVisible - position,
        cursor: isTop ? "grab" : "default",
        x: isTop ? x : 0,
        y: isTop ? y : peekY,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? dragFade : 1,
        touchAction: axis === "x" ? "pan-y" : "pan-x",
      }}
      whileTap={isTop ? { cursor: "grabbing" } : undefined}>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F4EEE0",
          borderRadius: 6,
          padding: "10px 10px 34px",
          boxShadow:
            "0 1px 2px rgba(0,0,0,0.35), 0 12px 24px -8px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
        }}>
        <div
          style={{
            flex: 1,
            borderRadius: 2,
            overflow: "hidden",
            position: "relative",
          }}>
          <img
            src={photo.src}
            alt={photo.label}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </div>
        <div
          style={{
            paddingTop: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}>
          <span
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 15,
              color: "#241F1B",
            }}>
            {photo.label}
          </span>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 10,
              letterSpacing: "0.08em",
              color: "#B9AE9C",
            }}>
            {position === 0 ? "top" : `+${position}`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------
// AxisToggle / AxisOption — a small compound pair, same shape as
// Header/Title/Counter above, instead of one component with a
// hard-coded list of options.
// ---------------------------------------------------------------------

function SwipeStackAxisToggle({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 8 }}>{children}</div>;
}

interface SwipeStackAxisOptionProps {
  axis: Axis;
  children: React.ReactNode;
}

function SwipeStackAxisOption({ axis, children }: SwipeStackAxisOptionProps) {
  const {
    state: { axis: activeAxis },
    actions: { setAxis },
  } = useSwipeStackContext();
  const active = activeAxis === axis;

  return (
    <button
      onClick={() => setAxis(axis)}
      style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 12,
        letterSpacing: "0.04em",
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? "#4F7C74" : "#43392f"}`,
        background: active ? "#4F7C74" : "transparent",
        color: active ? "#F4EEE0" : "#B9AE9C",
        cursor: "pointer",
      }}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// Public compound export
// ---------------------------------------------------------------------

export const SwipeStack = {
  Provider: SwipeStackProvider,
  Root: SwipeStackRoot,
  Header: SwipeStackHeader,
  Title: SwipeStackTitle,
  Counter: SwipeStackCounter,
  Deck: SwipeStackDeck,
  AxisToggle: SwipeStackAxisToggle,
  AxisOption: SwipeStackAxisOption,
};

// ---------------------------------------------------------------------
// Demo — a consumer composes exactly the pieces it wants, in the order
// it wants, the same way ThreadComposer/EditMessageComposer do in
// patterns-explicit-variants.md.
// ---------------------------------------------------------------------

const PHOTOS: Photo[] = [
  {
    src: "https://camo.githubusercontent.com/4e8dbf0fc0a7534ee1773a281472fc8855f71983a9cfa5d68946ad3c7dfaeaf2/68747470733a2f2f6d69726f2e6d656469756d2e636f6d2f76322f726573697a653a6669743a3433382f666f726d61743a776562702f312a75694b5436447130636478305f61733432644d4c76772e676966",
    label: "vertical — top, variant 1",
  },
  {
    src: "https://camo.githubusercontent.com/379fd80d1a7df9f69ab97848032fd355194ba579fa8992294fc619df656aaa1a/68747470733a2f2f6d69726f2e6d656469756d2e636f6d2f76322f726573697a653a6669743a3433382f666f726d61743a776562702f312a756c672d4962523078505042684a4a706d70553364672e676966",
    label: "horizontal — left, variant 1",
  },
  {
    src: "https://camo.githubusercontent.com/cf80937df569a00d5790093143d4d21cb45c653c54bd4be79fe44c7a0354fd09/68747470733a2f2f6d69726f2e6d656469756d2e636f6d2f76322f726573697a653a6669743a3433382f666f726d61743a776562702f312a6d474a6b392d6b4a595452614442446f76644b7650672e676966",
    label: "vertical — bottom, variant 2",
  },
  {
    src: "https://camo.githubusercontent.com/85b9ce1006e12d19f13e14c06225055cf9db9f4b91d1d04ed690f2162744aea1/68747470733a2f2f6d69726f2e6d656469756d2e636f6d2f76322f726573697a653a6669743a3433382f666f726d61743a776562702f312a33722d6f6d4c73314144752d654577345173426954672e676966",
    label: "horizontal — right, variant 2",
  },
];

export default function SwipeCardStackDemo() {
  return (
    <SwipeStack.Provider photos={PHOTOS}>
      <SwipeStack.Root>
        <SwipeStack.Header>
          <SwipeStack.Title>Drag the top card to swipe</SwipeStack.Title>
          <SwipeStack.Counter />
        </SwipeStack.Header>

        <SwipeStack.Deck />

        <SwipeStack.AxisToggle>
          <SwipeStack.AxisOption axis="x">
            horizontal swipe
          </SwipeStack.AxisOption>
          <SwipeStack.AxisOption axis="y">vertical swipe</SwipeStack.AxisOption>
        </SwipeStack.AxisToggle>
      </SwipeStack.Root>
    </SwipeStack.Provider>
  );
}
