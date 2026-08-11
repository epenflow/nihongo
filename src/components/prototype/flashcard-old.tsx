import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Draggable, gsap, useGSAP } from "#/lib/gsap";
import { cn } from "#/lib/utils";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
} from "react";

interface FlashCardProps extends ComponentProps<"div"> {
  stacked?: boolean;
}

export function FlashCard({
  className,
  children,
  stacked = true,
  ...props
}: FlashCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const animationStateRef = useRef(false);
  const [isFlipped, setFlipped] = useState(false);
  const { contextSafe } = useGSAP();

  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (animationStateRef.current) {
        return;
      }

      const animate = contextSafe(() => {
        const current = cardRef.current;
        if (!current) return;

        animationStateRef.current = true;

        const rect = current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const direction = mouseX < rect.width / 2 ? "-=180" : "+=180";

        setFlipped((prev) => !prev);

        gsap.to(current, {
          rotationY: direction,
          duration: 0.5,
          ease: "power3.inOut",
          overwrite: "auto",
          onComplete: () => {
            animationStateRef.current = false;
          },
        });
      });

      animate();
    },
    [contextSafe],
  );

  return (
    <div
      data-slot="card-root"
      className={cn(
        "w-96 h-105 perspective-[1000px] group",
        { "absolute inset-1/2 -translate-1/2": stacked === true },
        className,
      )}
      {...props}>
      <div
        ref={cardRef}
        data-slot="card"
        data-flipped={isFlipped}
        onClick={onClick}
        className={cn(
          "w-full h-full relative cursor-pointer border rounded-lg transition-shadow transform-3d bg-card group group-data-[dragging='true']:pointer-events-none",
          "[&_.card-face]:inset-0 [&_.card-face]:absolute [&_.card-face]:size-full [&_.card-face]:p-4 [&_.card-face]:rounded-md",
          "[&_.card-face]:backface-hidden [&_.card-face]:[-webkit-backface-visibility:hidden]",
          "[&_.card-face]:flex [&_.card-face]:flex-col [&_.card-face]:items-center [&_.card-face]:justify-center",
          "[&_.card-badge]:absolute [&_.card-badge]:top-2 [&_.card-badge]:left-2",
        )}>
        {children}
      </div>
    </div>
  );
}
export function FlashCardFront({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-front"
      className={cn("card-face", className)}
      {...props}>
      <Badge data-slot="card-badge" className="card-badge">
        Front
      </Badge>
      {children}
    </div>
  );
}
export function FlashCardBack({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-back"
      className={cn("card-face rotate-y-180", className)}
      {...props}>
      <Badge data-slot="card-badge" className="card-badge">
        Back
      </Badge>
      {children}
    </div>
  );
}

const STACK_DEPTH = 4;
const X_STEP = 18;
const Y_STEP = 18;
const SCALE_STEP = 0.05;
const OPACITY_STEP = 0;
const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_X = 600;
const ROTATION_FACTOR = 0.05;

interface FlashCardRootProps extends ComponentProps<"div"> {
  /**
   * The maximum number of cards visible in the stack at one time.
   * Cards beyond this depth are completely transparent and scaled down.
   */
  stackDepth?: number;
  /**
   * The horizontal offset (in pixels) applied to each subsequent card in the stack,
   * fanning them sideways to create the stacked visual effect.
   */
  xStep?: number;
  /**
   * The vertical offset (in pixels) applied to each subsequent card in the stack,
   * pushing them downwards to create the stacked visual effect.
   */
  yStep?: number;

  /**
   * The amount to scale down each subsequent card in the stack.
   * For example, a value of 0.05 makes each card 5% smaller than the one in front of it.
   */
  scaleStep?: number;

  /**
   * The amount to reduce the opacity for each subsequent card in the stack.
   * For example, a value of 0.25 reduces opacity by 25% per card depth.
   */
  opacityStep?: number;

  /**
   * The minimum horizontal drag distance (in pixels) required to trigger a swipe dismissal.
   * If dragged less than this distance, the card snaps back to the center.
   */
  swipeThreshold?: number;

  /**
   * The horizontal distance (in pixels) the card travels off-screen during the swipe-out animation.
   * Should be large enough to completely clear the screen/container.
   */
  swipeOutX?: number;

  /**
   * A multiplier that dictates how much the card rotates (tilts) as it is dragged horizontally.
   * For example, 0.05 rotates the card slightly based on the drag X-coordinate.
   */
  rotationFactor?: number;
}

export function FlashCardRoot({
  children,
  className,
  stackDepth = STACK_DEPTH,
  yStep = Y_STEP,
  xStep = X_STEP,
  scaleStep = SCALE_STEP,
  opacityStep = OPACITY_STEP,
  swipeThreshold = SWIPE_THRESHOLD,
  swipeOutX = SWIPE_OUT_X,
  rotationFactor = ROTATION_FACTOR,
  ...props
}: FlashCardRootProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef<HTMLDivElement[]>([]);
  const draggableRef = useRef<Draggable>(null);
  const animatingRef = useRef(false);
  const handlersRef = useRef<{ next: () => void; prev: () => void }>({
    next: () => {},
    prev: () => {},
  });

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLDivElement>(
        "[data-slot='card-root']",
      );

      if (!cards.length) return;

      orderRef.current = cards;

      function layout(index: number) {
        const depth = Math.min(index, stackDepth);
        return {
          zIndex: cards.length - index,
          x: depth * xStep,
          y: depth * yStep,
          scale: 1 - depth * scaleStep,
          opacity: index < stackDepth ? 1 - depth * opacityStep : 0,
          rotation: 0,
          pointerEvents: index === 0 ? "auto" : "none",
        };
      }

      function renderStack(animate: boolean) {
        orderRef.current.forEach((card, index) => {
          const vars = layout(index);
          if (animate) {
            gsap.to(card, {
              ...vars,
              duration: 0.35,
              ease: "power3.out",
              overwrite: "auto",
            });
          } else {
            gsap.set(card, vars);
          }
        });
      }

      function attachDraggable(card: HTMLDivElement) {
        draggableRef.current?.kill();

        [draggableRef.current] = Draggable.create(card, {
          type: "x,y",
          onDragStart() {
            card.dataset.dragging = "true";
          },
          onDrag() {
            gsap.set(card, { rotation: this.x * rotationFactor });
          },
          onDragEnd() {
            requestAnimationFrame(() => delete card.dataset.dragging);
            if (Math.abs(this.x) > swipeThreshold) {
              dismissFront(this.x > 0 ? 1 : -1);
            } else {
              gsap.to(card, {
                x: 0,
                y: 0,
                rotation: 0,
                duration: 0.3,
                ease: "power3.out",
              });
            }
          },
        });
      }

      function dismissFront(direction: 1 | -1) {
        if (animatingRef.current) return;
        const [front, ...rest] = orderRef.current;
        if (!front) return;

        animatingRef.current = true;
        draggableRef.current?.kill();

        gsap.to(front, {
          x: direction * swipeOutX,
          rotation: direction * 20,
          opacity: 0,
          duration: 0.35,
          ease: "power2.in",
          onComplete: () => {
            orderRef.current = [...rest, front];
            renderStack(true);
            attachDraggable(orderRef.current[0]);
            animatingRef.current = false;
          },
        });
      }

      function recallPrev() {
        if (animatingRef.current) return;
        const order = orderRef.current;
        const last = order[order.length - 1];
        if (!last) return;

        animatingRef.current = true;
        draggableRef.current?.kill();

        orderRef.current = [last, ...order.slice(0, -1)];

        gsap.set(last, {
          x: -swipeOutX,
          y: 0,
          rotation: -20,
          opacity: 0,
          zIndex: cards.length + 1,
        });
        renderStack(true);
        gsap.to(last, {
          x: 0,
          rotation: 0,
          opacity: 1,
          duration: 0.35,
          ease: "power3.out",
          onComplete: () => {
            attachDraggable(orderRef.current[0]);
            animatingRef.current = false;
          },
        });
      }

      renderStack(false);
      attachDraggable(orderRef.current[0]);

      handlersRef.current.next = () => dismissFront(-1);
      handlersRef.current.prev = () => recallPrev();

      return () => {
        draggableRef.current?.kill();
      };
    },
    {
      scope: containerRef,
      dependencies: [
        stackDepth,
        xStep,
        yStep,
        scaleStep,
        opacityStep,
        swipeThreshold,
        swipeOutX,
        rotationFactor,
      ],
    },
  );

  const onNext = useCallback(() => handlersRef.current.next(), []);
  const onPrev = useCallback(() => handlersRef.current.prev(), []);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full h-screen overflow-hidden", className)}
      {...props}>
      <div
        data-slot="card-container"
        className="absolute w-96 h-fit top-1/2 left-1/2 -translate-1/2">
        {children}
      </div>
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2">
        <Button onClick={onPrev} size="icon">
          <span className="sr-only">Previous Button</span>
          <ArrowLeftIcon />
        </Button>
        <Button onClick={onNext} size="icon">
          <span className="sr-only">Next Button</span>
          <ArrowRightIcon />
        </Button>
      </div>
    </div>
  );
}
