import { cn } from "#/lib/utils.ts";
import { mergeProps } from "@base-ui/react";
import { motion } from "motion/react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type MouseEvent,
} from "react";

interface CardContextValue {}
const CardContext = createContext<CardContextValue | null>(null);
function useCard(name: string) {
  const context = use(CardContext);

  if (context == null) {
    throw new Error(`${name} component should be used within <Card.Root/>`);
  }

  return context;
}

interface RootProps extends ComponentPropsWithoutRef<"div"> {
  multiplier?: number;
}
function Root({ className, multiplier = 2.5, ...props }: RootProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [rotation, setRotation] = useState<number>(0);

  const onRotate = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const current = event.currentTarget;
    const rect = current.getBoundingClientRect();

    setRotation(
      (prev) =>
        prev + (event.clientX - rect.left < rect.width / 2 ? 180 : -180),
    );
  }, []);

  const context: CardContextValue = useMemo(() => ({}), []);

  useEffect(() => {
    const current = containerRef.current;

    if (!current) return;

    function resize() {
      const current = containerRef.current;
      if (!current) return;

      const rect = current.getBoundingClientRect();

      const value = Math.max(rect.width, rect.height) * multiplier;
      current.style.setProperty("--perspective", value.toString());
    }

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(current);

    return () => observer.disconnect();
  }, [multiplier]);

  return (
    <CardContext value={context}>
      <div
        ref={containerRef}
        data-slot="card"
        className="size-auto perspective-(--perspective) relative">
        <motion.div
          data-slot="content"
          animate={{ rotateY: rotation }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className={cn(
            "w-96 h-105 relative transform-3d cursor-pointer rounded-xl bg-card border",
            className,
          )}
          {...mergeProps(props, { onClick: onRotate })}
        />
      </div>
    </CardContext>
  );
}

interface FaceProps extends ComponentProps<"div"> {}

function Front({ className, ...props }: FaceProps) {
  const context = useCard("Card.Front");

  return (
    <div
      data-slot="front"
      className={cn(
        "backface-hidden absolute inset-0 size-full group/front overflow-clip",
        className,
      )}
      {...props}
    />
  );
}

function Back({ className, ...props }: FaceProps) {
  const context = useCard("Card.Back");

  return (
    <div
      data-slot="back"
      className={cn(
        "backface-hidden absolute inset-0 size-full group/back overflow-clip",
        "rotate-y-180",
        className,
      )}
      {...props}
    />
  );
}

export const Card = {
  Root,
  Front,
  Back,
};
