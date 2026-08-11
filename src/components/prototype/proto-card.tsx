import { Badge } from "#/components/ui/badge.tsx";
import { cn } from "#/lib/utils.ts";
import { motion, type Transition } from "motion/react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
} from "react";

type DivProps = ComponentPropsWithoutRef<"div">;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface FlashCardContextValue {
  flipped: boolean;
  flip: (event?: MouseEvent<HTMLElement>) => void;
  rotation: number;
  isAnimating: boolean;
  disabled: boolean;
}

const FlashCardContext = createContext<FlashCardContextValue | null>(null);

function useFlashCardContext(name: string) {
  const context = use(FlashCardContext);

  if (context == null) {
    throw new Error(`${name} must be used within FlashCard.Root`);
  }

  return context;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

const FLIP_ROTATION = 180;
const FLIP_MAX_ROTATION = 360;
const MULTIPLIER = 2.5;

const DEFAULT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 100,
  damping: 20,
};

function normalizeAngle(rotation: number) {
  return (
    ((rotation % FLIP_MAX_ROTATION) + FLIP_MAX_ROTATION) % FLIP_MAX_ROTATION
  );
}

interface FlashCardRootProps extends DivProps {
  /** Controlled flipped state. Omit to use uncontrolled `defaultFlipped`. */
  flipped?: boolean;
  /** Initial flipped state when uncontrolled. */
  defaultFlipped?: boolean;
  /** Called whenever the flipped state changes (controlled or uncontrolled). */
  onFlippedChange?: (flipped: boolean) => void;
  /** Disables the flip interaction entirely. */
  disabled?: boolean;
  /** Motion transition used for the flip animation. */
  transition?: Transition;
  /**
   * How much larger the CSS perspective is relative to the card's largest
   * dimension. Higher values flatten the 3D effect.
   */
  multiplier?: number;
  debug?: Partial<{ guide: boolean; rotation: boolean }>;
}

function Root({
  flipped: controlledFlipped,
  defaultFlipped = false,
  onFlippedChange,
  disabled = false,
  transition = DEFAULT_TRANSITION,
  multiplier = MULTIPLIER,
  debug,
  className,
  children,
  ...props
}: FlashCardRootProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledFlipped !== undefined;
  const [uncontrolledFlipped, setUncontrolledFlipped] =
    useState(defaultFlipped);
  const flipped = isControlled ? controlledFlipped : uncontrolledFlipped;

  const [rotation, setRotation] = useState(flipped ? FLIP_ROTATION : 0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Keep the animated rotation in sync if `flipped` changes from outside
  // (e.g. parent toggles it programmatically rather than via a click).
  useEffect(() => {
    if (!isControlled) return;

    setRotation((prev) => {
      const currentlyFlipped = normalizeAngle(prev) === FLIP_ROTATION;
      return currentlyFlipped === controlledFlipped
        ? prev
        : prev + FLIP_ROTATION;
    });
  }, [controlledFlipped, isControlled]);

  const flip = useCallback(
    (event?: MouseEvent<HTMLElement>) => {
      if (disabled) return;

      event?.preventDefault();
      event?.stopPropagation();

      let direction = FLIP_ROTATION;
      if (event) {
        const rect = event.currentTarget.getBoundingClientRect();
        direction =
          event.clientX - rect.left < rect.width / 2
            ? FLIP_ROTATION
            : -FLIP_ROTATION;
      }

      setIsAnimating(true);
      setRotation((prev) => prev + direction);

      const next = !flipped;
      if (!isControlled) setUncontrolledFlipped(next);
      onFlippedChange?.(next);
    },
    [disabled, flipped, isControlled, onFlippedChange],
  );

  useEffect(() => {
    const current = containerRef.current;
    if (!current) return;

    function perspective() {
      if (!current) return;
      const rect = current.getBoundingClientRect();
      const value = Math.max(rect.width, rect.height) * multiplier;
      current.style.setProperty("--perspective", value.toString());
    }

    perspective();
    const observer = new ResizeObserver(perspective);
    observer.observe(current);
    return () => observer.disconnect();
  }, [multiplier]);

  const context: FlashCardContextValue = {
    flipped,
    flip,
    rotation,
    isAnimating,
    disabled,
  };

  return (
    <FlashCardContext value={context}>
      <div
        ref={containerRef}
        data-slot="card"
        data-state={flipped ? "flipped" : "idle"}
        data-disabled={disabled || undefined}
        className={cn(
          "w-96 h-105 perspective-(--perspective) relative group/card",
          className,
        )}
        {...props}>
        <motion.div
          data-slot="content"
          data-side={flipped ? "back" : "front"}
          onClick={flip}
          onAnimationComplete={() => setIsAnimating(false)}
          animate={{ rotateY: rotation }}
          transition={transition}
          className={cn(
            "size-full relative transform-3d cursor-pointer group/content",
            "rounded-xl bg-card border",
            disabled && "cursor-not-allowed pointer-events-none opacity-60",
            debug?.guide &&
              "before:absolute before:w-full before:h-px before:inset-1/2 before:-translate-1/2 before:bg-red-500 before:z-50 before:pointer-events-none after:absolute after:w-px after:h-full after:inset-1/2 after:-translate-1/2 after:bg-red-500 after:z-50 after:pointer-events-none",
          )}>
          {children}
        </motion.div>
      </div>
    </FlashCardContext>
  );
}

// ---------------------------------------------------------------------------
// Front / Back
// ---------------------------------------------------------------------------

function Front({ className, children, ...props }: DivProps) {
  const { flipped } = useFlashCardContext("FlashCard.Front");

  return (
    <div
      data-slot="front"
      data-side="front"
      aria-hidden={flipped}
      className={cn(
        "backface-hidden absolute inset-0 size-full group/front overflow-clip",
        className,
      )}
      {...props}>
      <Badge data-slot="badge" className="absolute inset-1">
        Front
      </Badge>
      {children}
    </div>
  );
}

function Back({ className, children, ...props }: DivProps) {
  const { flipped } = useFlashCardContext("FlashCard.Back");

  return (
    <div
      data-slot="back"
      data-side="back"
      aria-hidden={!flipped}
      className={cn(
        "backface-hidden absolute inset-0 size-full group/back rotate-y-180",
        className,
      )}
      {...props}>
      <Badge data-slot="badge" className="absolute inset-1">
        Back
      </Badge>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const FlashCard = { Root, Front, Back };
export { useFlashCardContext };
export type { FlashCardContextValue, FlashCardRootProps };
