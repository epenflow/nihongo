import { Badge } from "#/components/ui/badge.tsx";
import { cn } from "#/lib/utils.ts";
import { motion, type Transition } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
} from "react";
export * from "./carousel";

const FlipContext = createContext<boolean | null>(null);

function useFlip(name: string) {
  const context = useContext(FlipContext);

  if (context == null) {
    throw new Error(`${name} component should be used within FlashCard.Root`);
  }

  return context;
}

interface FlashCardRootProps extends ComponentProps<"div"> {
  guides?: Partial<{ x: boolean; y: boolean }>;
  transition?: Transition;
  multiplier?: number;
  loop?: boolean;
}

function FlashCardRoot({
  className,
  children,
  guides,
  transition,
  multiplier = 2.5,
  loop = true,
  ...props
}: FlashCardRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [infiniteRotation, setInfiniteRotation] = useState<number>(0);

  const onClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const current = event.currentTarget;

    const rect = current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const direction = mouseX < rect.width / 2 ? 180 : -180;

    setInfiniteRotation((prev) => prev + direction);
  }, []);

  useEffect(() => {
    const current = rootRef.current;

    if (!current) return;

    const calculatePerspective = () => {
      const rect = current.getBoundingClientRect();
      current.style.setProperty(
        "--flashcard-perspective",
        `${Math.max(rect.width, rect.height) * multiplier}px`,
      );
    };

    calculatePerspective();

    const observer = new ResizeObserver(() => {
      calculatePerspective();
    });

    observer.observe(current);

    return () => observer.disconnect();
  }, [multiplier]);

  const rotation = ((infiniteRotation % 360) + 360) % 360;
  const flipped = rotation === 180;

  return (
    <FlipContext value={flipped}>
      <div
        ref={rootRef}
        data-slot="flashcard-root"
        className={cn(
          "w-96 h-105 perspective-(--flashcard-perspective) group/flashcard-root",
          className,
        )}
        {...props}>
        <motion.div
          data-slot="flashcard-content"
          onClick={onClick}
          animate={{ rotateY: loop ? infiniteRotation : rotation }}
          data-flipped={flipped}
          data-side={flipped ? "back" : "front"}
          transition={
            transition || {
              type: "spring",
              stiffness: 100,
              damping: 20,
            }
          }
          className={cn(
            "w-full h-full group/flashcard-content relative bg-card border rounded-xl transform-3d cursor-pointer group-data-[dragging=true]/dragging:pointer-events-none",
            {
              "after:absolute after:h-full after:w-px after:inset-1/2 after:-translate-1/2 after:bg-red-500 after:z-50 after:pointer-events-none":
                guides && guides.x,
              "before:absolute before:h-px before:w-full before:inset-1/2 before:-translate-1/2 before:bg-red-500 before:z-50 before:pointer-events-none":
                guides && guides.y,
            },
          )}>
          {children}
        </motion.div>
      </div>
    </FlipContext>
  );
}

function FlashCardFront({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  const flipped = useFlip("FlashCard.Front");

  return (
    <div
      data-slot="flashcard-front"
      data-visible={!flipped}
      aria-hidden={flipped}
      className={cn(
        "backface-hidden absolute inset-0 size-full group/flashcard-front",
        className,
      )}
      {...props}>
      <Badge className="absolute top-1 left-1">Front</Badge>
      {children}
    </div>
  );
}
function FlashCardBack({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  const flipped = useFlip("FlashCard.Back");

  return (
    <div
      data-slot="flashcard-back"
      data-visible={flipped}
      aria-hidden={!flipped}
      className={cn(
        "backface-hidden absolute inset-0 size-full group/flashcard-back rotate-y-180",
        className,
      )}
      {...props}>
      <Badge className="absolute top-1 left-1">Back</Badge>
      {children}
    </div>
  );
}

export const FlashCard = {
  Root: FlashCardRoot,
  Front: FlashCardFront,
  Back: FlashCardBack,
};
