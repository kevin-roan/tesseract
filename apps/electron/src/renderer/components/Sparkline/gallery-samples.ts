const wave = (index: number) => 0.45 + 0.3 * Math.sin(index / 4) + 0.1 * Math.sin(index * 1.7);

export const SPARKLINE_FULL = Array.from({ length: 60 }, (_, index) => wave(index));
export const SPARKLINE_PARTIAL = SPARKLINE_FULL.slice(0, 24);
export const SPARKLINE_MAX = 1;
