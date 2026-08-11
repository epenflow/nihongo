import { Button, type ButtonProps } from "#/components/ui/button.tsx";
import { Draggable, gsap, useGSAP } from "#/lib/gsap.ts";
import type { Overwrite } from "#/lib/types.ts";
import { cn, rotate } from "#/lib/utils.ts";
import { mergeProps, useRender } from "@base-ui/react";
import {
  createContext,
  use,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const GUIDE = false;

interface CarouselContext {
  orders: string[];
  register(item: string): void;
  unregister(item: string): void;
  nextOffset: VoidFunction;
  prevOffset: VoidFunction;
}

const CarouselContext = createContext<CarouselContext | null>(null);

function useCarousel(name: string) {
  const context = use(CarouselContext);

  if (context == null) {
    throw new Error(`${name} should be used within Carousel.Root`);
  }

  return context;
}

function Root({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  const [data, setData] = useState<string[]>([]);
  const [offset, setOffset] = useState<number>(0);

  const orders = useMemo(() => rotate(data, offset), [data, offset]);

  const register = useCallback(
    (item: string) =>
      setData((prev) => (prev.includes(item) ? prev : [...prev, item])),
    [],
  );

  const unregister = useCallback(
    (item: string) =>
      setData((prev) => prev.filter((predicate) => predicate !== item)),
    [],
  );

  const nextOffset = useCallback(() => setOffset((prev) => prev + 1), []);
  const prevOffset = useCallback(() => setOffset((prev) => prev - 1), []);

  const children = useRender({
    defaultTagName: "div",
    render,
    state: {
      slot: "carousel",
    },
    props: mergeProps<"div">(
      {
        className: cn(
          "min-h-svh h-full w-full",
          {
            "border border-red-500": GUIDE,
          },
          className,
        ),
      },
      props,
    ),
  });

  const context: CarouselContext = useMemo(
    () => ({ orders, register, unregister, nextOffset, prevOffset }),
    [orders, register, unregister, nextOffset, prevOffset],
  );

  return <CarouselContext value={context}>{children}</CarouselContext>;
}

function Viewport({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    state: { slot: "viewport" },
    props: mergeProps<"div">(
      {
        className: cn(
          "relative size-full overflow-clip",
          {
            "border border-red-500 before:absolute before:w-px before:h-full before:z-50 before:bg-red-500 before:pointer-events-none before:inset-1/2 before:-translate-1/2 after:absolute after:w-full after:h-px after:z-50 after:bg-red-500 after:pointer-events-none after:inset-1/2 after:-translate-1/2":
              GUIDE,
          },
          className,
        ),
      },
      props,
    ),
  });
}

type ItemProps = Overwrite<
  useRender.ComponentProps<"div">,
  {
    children?:
      | ((props: {
          dragging: boolean;
          dismissed: boolean;
          firstIndex: boolean;
        }) => ReactNode)
      | ReactNode;
  }
>;

const MAX_DEPTH_ROTATE = 6.5;
const MAX_DEPTH_Y = -12;
const MAX_DEPTH_X = 6;
const MAX_DEPTH_SCALE = 0.04;
const MAX_VISIBLE_STACK = 6;
const RESET_DURATION = 0;

function Item({ className, render, children, ...props }: ItemProps) {
  const id = useId();

  const scopeRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<boolean>(false);
  const wasFirstIndexRef = useRef<boolean>(false);

  const [dragging, setDragging] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  const { orders, register, unregister, nextOffset } =
    useCarousel("Carousel.Item");

  const currentIndex = orders.indexOf(id);
  const firstIndex = currentIndex === 0;

  useLayoutEffect(() => {
    register(id);

    return () => unregister(id);
  }, [id, register, unregister]);

  const { contextSafe } = useGSAP({ scope: scopeRef });

  const onReset = contextSafe(() => {
    const card = scopeRef.current?.querySelector("[data-slot='card']");
    if (!card) return;

    // dispatch custom event yang sudah didengarkan Card.Root, tapi
    // beri tahu Card.Root untuk meng-animasikan rotateY (lihat card.tsx),
    // bukan gsap.set langsung.
    card.dispatchEvent(
      new CustomEvent("card:reset", {
        detail: { duration: RESET_DURATION },
      }),
    );
  });

  useGSAP(
    () => {
      const current = scopeRef.current;
      if (!current || currentIndex === -1) return;

      const minIndex = Math.min(currentIndex, MAX_VISIBLE_STACK);

      const depthX = firstIndex ? 0 : minIndex * MAX_DEPTH_X;
      const depthY = firstIndex ? 0 : minIndex * MAX_DEPTH_Y;
      const depthRotate = firstIndex ? 0 : minIndex * MAX_DEPTH_ROTATE;
      const depthScale = firstIndex ? 1 : 1 - minIndex * MAX_DEPTH_SCALE;

      const currentZIndex = orders.length - currentIndex;
      const wasFirstIndex = wasFirstIndexRef.current;
      wasFirstIndexRef.current = firstIndex;

      if (!revealRef.current) {
        revealRef.current = true;

        const radius = 180;
        const startAngle = 80;
        const proxy = { angle: startAngle };
        const rad0 = (startAngle * Math.PI) / 180;

        gsap.set(current, {
          autoAlpha: 0,
          x: radius * Math.sin(rad0) + depthX,
          y: radius * (1 - Math.cos(rad0)) + depthY,
          rotate: startAngle + depthRotate,
          scale: depthScale,
          zIndex: currentZIndex,
        });

        const tl = gsap.timeline({ delay: currentIndex * 0.09 });

        tl.to(
          current,
          { autoAlpha: 1, duration: 0.5, ease: "power3.out" },
          0,
        ).to(
          proxy,
          {
            angle: 0,
            duration: 0.6,
            ease: "power3.out",
            onUpdate: () => {
              const rad = (proxy.angle * Math.PI) / 180;
              gsap.set(current, {
                x: radius * Math.sin(rad) + depthX,
                y: radius * (1 - Math.cos(rad)) + depthY,
                rotate: proxy.angle + depthRotate,
                scale: depthScale,
              });
            },
          },
          0,
        );
      } else {
        if (wasFirstIndex && !firstIndex) {
          onReset();
        }

        gsap.to(current, {
          x: depthX,
          y: depthY,
          rotate: depthRotate,
          scale: depthScale,
          zIndex: currentZIndex,
          duration: 0.4,
          ease: "power2.out",
        });
      }
    },
    {
      scope: scopeRef,
      dependencies: [currentIndex, orders.length, firstIndex],
    },
  );

  useGSAP(
    () => {
      const current = scopeRef.current;

      if (!current || !firstIndex) return;

      const viewport = current.closest("[data-slot='viewport']");
      const card = current.querySelector("[data-slot='card']");

      let hasExceededBounds = false;

      Draggable.create(current, {
        type: "y,x",
        bounds: viewport,
        onDrag() {
          gsap.to(current, {
            rotate: this.x * 0.05,
            duration: 0.1,
            overwrite: "auto",
          });

          hasExceededBounds =
            Math.abs(this.x) > current.offsetWidth / 2 ||
            Math.abs(this.y) > current.offsetHeight / 2;

          setDismissed(hasExceededBounds);
        },
        onDragStart() {
          setDragging(true);

          gsap.to(current, {
            scale: 0.9,
            duration: 0.3,
            ease: "power2.out",
          });
        },
        onDragEnd(this) {
          setDragging(false);

          const timeline = gsap.timeline();
          timeline.to(current, { x: 0, y: 0, rotate: 0 }, 0);

          if (hasExceededBounds) {
            timeline.set(current, { zIndex: -100, immediateRender: true });
            nextOffset();

            const minIndex = Math.min(orders.length - 1, MAX_VISIBLE_STACK);
            const currentScale = 1 - minIndex * MAX_DEPTH_SCALE;

            timeline.fromTo(
              current,
              {
                autoAlpha: 0.95,
                scale: 0.65,
                ease: "sine.out(1)",
              },
              {
                scale: currentScale,
                autoAlpha: 1,
                ease: "bounce.in(1)",
                onStart: () => {
                  card?.dispatchEvent(new CustomEvent("card:reset"));
                  setDismissed(false);
                },
              },
            );
          } else {
            timeline.to(
              current,
              {
                scale: 1,
                duration: 0.4,
                ease: "back.out(1.5)",
              },
              0,
            );
          }
        },
      });
    },
    { scope: scopeRef, dependencies: [firstIndex, orders.length] },
  );

  const node = useMemo(
    () =>
      typeof children === "function"
        ? children?.({ dragging, dismissed, firstIndex })
        : children,
    [dragging, dismissed, firstIndex, children],
  );

  return useRender({
    defaultTagName: "div",
    render,
    ref: scopeRef,
    state: { slot: "item" },
    props: mergeProps<"div">(
      {
        className: cn(
          "absolute left-1/2 top-1/2 -translate-1/2",
          "invisible opacity-0",
          className,
        ),
        children: node,
      },
      props,
    ),
  });
}

function Next(props: ButtonProps) {
  const { nextOffset } = useCarousel("Carousel.Next");

  return <Button {...mergeProps({ onClick: nextOffset }, props)} />;
}

function Prev(props: ButtonProps) {
  const { prevOffset } = useCarousel("Carousel.Prev");

  return <Button {...mergeProps({ onClick: prevOffset }, props)} />;
}

export const Carousel = {
  Root,
  Viewport,
  Item,
  Next,
  Prev,
};
