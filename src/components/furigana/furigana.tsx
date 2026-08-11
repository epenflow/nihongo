import {
  FURIGANA_PATTERN,
  parseFurigana,
} from "#/components/furigana/utils.ts";
import { cn } from "#/lib/utils.ts";
import type { Overwrite } from "@tanstack/react-table";
import type { ComponentProps } from "react";

interface FuriganaProps extends Overwrite<
  ComponentProps<"span">,
  {
    children: string;
  }
> {
  pattern?: RegExp;
}

export function Furigana({
  children,
  pattern = FURIGANA_PATTERN,
  className,
  ...props
}: FuriganaProps) {
  const segments = parseFurigana(children, pattern);
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
