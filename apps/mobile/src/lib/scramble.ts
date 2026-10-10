export const SCRAMBLE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type ScrambleLetter = { char: string; settled: boolean };

/**
 * One frame of a decode effect at `progress` (0 to 1): after `hold`, letters settle left to right;
 * the rest show a random glyph. Spaces always stay spaces.
 */
export function scrambleFrame(text: string, progress: number, hold = 0, random = Math.random): ScrambleLetter[] {
  const letters = Array.from(text);
  const run = Math.min(1, Math.max(0, (progress - hold) / (1 - hold)));
  const settledCount = progress >= 1 ? letters.length : Math.floor(run * letters.length);

  return letters.map((char, index) => {
    if (index < settledCount || char.trim() === "") return { char, settled: true };
    return { char: SCRAMBLE_GLYPHS[Math.floor(random() * SCRAMBLE_GLYPHS.length)], settled: false };
  });
}
