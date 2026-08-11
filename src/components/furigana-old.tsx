import type { Overwrite } from "#/lib/types";
import { cn } from "#/lib/utils";
import type { ComponentProps } from "react";

export const FURIGANA_PATTERN = /([\p{Unified_Ideograph}\w]+)\[([^\]]+)\]/gu;

interface FuriganaProps extends Overwrite<
  ComponentProps<"span">,
  {
    children: string;
  }
> {
  pattern?: RegExp;
}

interface FuriganaSegment {
  base: string;
  reading?: string;
}

export function parseFuriganaSegments(
  input: string,
  pattern: RegExp = FURIGANA_PATTERN,
): FuriganaSegment[] {
  const segments: FuriganaSegment[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(pattern)) {
    const [full, base, reading] = match;
    const startIndex = match.index ?? 0;

    if (startIndex > lastIndex) {
      segments.push({ base: input.slice(lastIndex, startIndex) });
    }

    segments.push({ base, reading });
    lastIndex = startIndex + full.length;
  }

  if (lastIndex < input.length) {
    segments.push({ base: input.slice(lastIndex) });
  }

  return segments;
}

export function Furigana({
  children,
  pattern = FURIGANA_PATTERN,
  className,
  ...props
}: FuriganaProps) {
  const segments = parseFuriganaSegments(children, pattern);
  const accessibility = segments.map((segment) => segment.base).join("");

  return (
    <span
      data-slot="furigana-root"
      className={cn("font-sawarabi-mincho", className)}
      {...props}>
      <span className="sr-only">{accessibility}</span>
      <span aria-hidden={true} className="inline-flex items-baseline">
        {segments.map((segment, index) =>
          segment.reading ? (
            <ruby data-slot="furigana-segment" key={index}>
              <span data-slot="furigana-base">{segment.base}</span>
              <rt data-slot="furigana-reading">{segment.reading}</rt>
            </ruby>
          ) : (
            <span key={index} data-slot="furigana-base">
              {segment.base}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
