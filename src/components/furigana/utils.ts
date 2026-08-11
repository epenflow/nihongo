export const FURIGANA_PATTERN = /([\p{Unified_Ideograph}\w]+)\[([^\]]+)\]/gu;

interface FuriganaSegment {
  base: string;
  reading?: string;
}

export function parseFurigana(
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
