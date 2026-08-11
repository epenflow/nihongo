import { gsap, useGSAP } from "#/lib/gsap.ts";
import { cn } from "#/lib/utils.ts";
import { mergeProps, useRender } from "@base-ui/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";

const PERSPECTIVE_MULTIPLIER = 2.25;
const MAX_TILT = 20;
const TILT_OFFSET = 0.5;
const GUIDE = false;

function Tilt({
  render,
  className,
  ...props
}: useRender.ComponentProps<"div">) {
  const { contextSafe } = useGSAP();

  const onMouseMove = contextSafe((event: MouseEvent<HTMLDivElement>) => {
    const current = event.currentTarget;
    const rect = current.getBoundingClientRect();

    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const centerX = cursorX / rect.width;
    const centerY = cursorY / rect.height;

    const rotateX = (TILT_OFFSET - centerY) * MAX_TILT;
    const rotateY = (centerX - TILT_OFFSET) * MAX_TILT;

    gsap.to(current, {
      rotateX: rotateX,
      rotateY: rotateY,
      overwrite: "auto",
      duration: 0.3,
      ease: "power2.out",
    });
  });

  const onMouseLeave = contextSafe((event: MouseEvent<HTMLDivElement>) => {
    const current = event.currentTarget;

    gsap.to(current, {
      rotateX: 0,
      rotateY: 0,
      overwrite: true,
      duration: 0.5,
      ease: "power2.out",
    });
  });

  return useRender({
    render,
    defaultTagName: "div",
    state: { slot: "tilt" },
    props: mergeProps<"div">(
      {
        onMouseMove,
        onMouseLeave,
        className: cn(
          "will-change-transform transform-3d",
          { "border border-red-500": GUIDE },
          className,
        ),
      },
      props,
    ),
  });
}

function Root({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & {
  reset?: boolean;
}) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const disableRef = useRef<boolean>(false);
  const rotateRef = useRef<boolean>(false);
  const [side, setSide] = useState<"front" | "back">("front");

  const { contextSafe } = useGSAP({ scope: scopeRef });

  useLayoutEffect(() => {
    if (!scopeRef.current) return;

    const current = scopeRef.current;

    const onResize = () => {
      const rect = current.getBoundingClientRect();
      const value = String(
        Math.max(rect.width, rect.height) * PERSPECTIVE_MULTIPLIER + "px",
      );

      current.style.setProperty("--perspective", value);
    };

    onResize();

    const observer = new ResizeObserver(onResize);

    observer.observe(current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const current = scopeRef.current;

    if (!current) return;

    const onReset = contextSafe((event: Event) => {
      if (!rotateRef.current) return;

      const content = current.querySelector?.<HTMLDivElement>(
        "[data-slot='content']",
      );

      const duration =
        (event as CustomEvent<{ duration?: number }>).detail?.duration ?? 0;

      gsap.killTweensOf(content);

      if (duration > 0) {
        gsap.to(content, {
          rotateY: 0,
          duration,
          ease: "power2.out",
          overwrite: true,
        });
      } else {
        gsap.set(content, { rotateY: 0 });
      }

      disableRef.current = false;
      rotateRef.current = false;

      setSide("front");
    });

    current.addEventListener("card:reset", onReset);

    return () => current.removeEventListener("card:reset", onReset);
  }, [contextSafe]);

  // eslint-disable-next-line react-hooks/refs
  const onClick = contextSafe((event: MouseEvent<HTMLDivElement>) => {
    const current = event.currentTarget;
    const rect = current.getBoundingClientRect();
    const direction = event.clientX - rect.left < rect.width / 2;

    // lock animation
    if (disableRef.current) return;
    disableRef.current = true;

    gsap.to(current, {
      rotateY: direction ? `+=180` : `-=180`,
      ease: "power4.inOut",
      duration: 0.5,
      overwrite: true,
      force3D: true,
      onStart() {
        rotateRef.current = !rotateRef.current;

        setSide(rotateRef.current ? "back" : "front");
      },
      onComplete() {
        disableRef.current = false;
      },
    });
  });

  const children = useRender({
    defaultTagName: "div",
    render,
    state: {
      slot: "content",
      side,
    },
    props: mergeProps<"div">(
      {
        onClick: onClick,
        className: cn(
          "bg-card rounded-xl border w-96 h-105 relative transform-3d will-change-transform group/content origin-center",
          "data-[dragging=true]:pointer-events-none",
          {
            "before:absolute before:w-px before:h-full before:bg-red-500 before:inset-1/2 before:-translate-1/2 after:absolute after:w-full after:h-px after:bg-red-500 after:inset-1/2 after:-translate-1/2 border-red-500":
              GUIDE,
          },
          className,
        ),
      },
      props,
    ),
  });

  return (
    <div
      data-slot="card"
      ref={scopeRef}
      className={cn(
        "perspective-(--perspective) size-auto relative group/card",
        {
          "border border-red-500": GUIDE,
        },
      )}>
      {children}
    </div>
  );
}

function Front({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    state: {
      slot: "front",
    },
    props: mergeProps<"div">(
      {
        className: cn(
          "backface-hidden absolute inset-0 size-full overflow-clip group/front",
          "group-data-[side=back]/content:pointer-events-none",
          className,
        ),
      },
      props,
    ),
  });
}

function Back({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    state: {
      slot: "back",
    },
    props: mergeProps<"div">(
      {
        className: cn(
          "backface-hidden absolute inset-0 size-full overflow-clip group/back",
          "rotate-y-180",
          "group-data-[side=front]/content:pointer-events-none",
          className,
        ),
      },
      props,
    ),
  });
}

export const Card = {
  Root,
  Back,
  Front,
  Tilt,
};
