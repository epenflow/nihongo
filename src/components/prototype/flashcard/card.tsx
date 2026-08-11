import { Badge } from "#/components/ui/badge.tsx";
import { cn } from "#/lib/utils.ts";
import { motion, type Variants } from "motion/react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
} from "react";

interface CardContextValue {
  visibility: boolean;
}

const CardContext = createContext<CardContextValue | null>(null);

function useCard(name: string) {
  const context = use(CardContext);

  if (context == null) {
    throw new Error(name + " component should be used within FlashCard.Root");
  }

  return context;
}

interface RootProps extends ComponentProps<"div"> {
  loop?: boolean;
  multiplier?: number;
  debug?: Partial<{ guide: boolean; rotation: boolean }>;
}

const ROTATION = 180;
const MAX_ROTATION = 360;
const MULTIPLIER = 2.5;

function Root({
  multiplier = MULTIPLIER,
  loop,
  debug,
  className,
  children,
  ...props
}: RootProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);

  const onClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const current = event.currentTarget;

    const rect = current.getBoundingClientRect();

    setRotation(
      (prev) =>
        prev +
        (event.clientX - rect.left < rect.width / 2 ? ROTATION : -ROTATION),
    );
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    function perspective() {
      const current = containerRef.current;

      if (!current) return;

      const rect = current.getBoundingClientRect();
      const value = Math.max(rect.width, rect.width) * multiplier;

      current.style.setProperty("--perspective", value.toString());
    }

    perspective();

    const observer = new ResizeObserver(perspective);

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [multiplier]);

  const angle = ((rotation % MAX_ROTATION) + MAX_ROTATION) % MAX_ROTATION;
  const visibility = angle === ROTATION;
  const side = visibility ? "back" : "front";

  return (
    <CardContext value={{ visibility }}>
      <div
        ref={containerRef}
        data-slot="card"
        className={cn(
          "w-96 h-105 perspective-(--perspective) relative group/card",
          className,
        )}
        {...props}>
        <motion.div
          data-slot="content"
          data-side={side}
          onClick={onClick}
          animate={{
            rotateY: loop ? rotation : angle,
          }}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 20,
          }}
          className={cn(
            "size-full relative transform-3d cursor-pointer group/content",
            "rounded-xl bg-card border",
            {
              "before:absolute before:w-full before:h-px before:inset-1/2 before:-translate-1/2 before:bg-red-500 before:z-50 before:pointer-events-none after:absolute after:w-px after:h-full after:inset-1/2 after:-translate-1/2 after:bg-red-500 after:z-50 after:pointer-events-none":
                debug?.guide,
            },
          )}>
          {children}
        </motion.div>
      </div>
    </CardContext>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const variants: Variants = {
  initial: { x: "-100%", opacity: 0 },
  start: {
    x: "0%",
    opacity: 1,
    transition: {
      type: "tween",
      ease: [0.25, 1, 0.5, 1],
      duration: 0.5,
      delay: 0.1,
    },
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: {
      type: "tween",
      ease: [0.25, 1, 0.5, 1],
      duration: 0.3,
    },
  },
};

function Front({ className, children, ...props }: ComponentProps<"div">) {
  const { visibility } = useCard("FlashCard.Front");

  return (
    <div
      data-slot="front"
      data-visibility={!visibility}
      aria-hidden={visibility}
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
function Back({ className, children, ...props }: ComponentProps<"div">) {
  const { visibility } = useCard("FlashCard.Back");

  return (
    <div
      data-slot="back"
      data-visibility={visibility}
      aria-hidden={!visibility}
      className={cn(
        "backface-hidden absolute inset-0 size-full group/back",
        "rotate-y-180",
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

export const FlashCard = {
  Root,
  Front,
  Back,
};
