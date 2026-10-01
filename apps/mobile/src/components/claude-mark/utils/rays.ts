export type Ray = { x1: number; y1: number; x2: number; y2: number };

const RAY_REACH = [1, 0.74, 0.9, 0.68, 0.97, 0.78, 0.93, 0.7, 1, 0.8, 0.88, 0.72] as const;
const INNER_RATIO = 0.1;
const ROTATION = -Math.PI / 2;

export const STROKE_RATIO = 0.075;
export const DEFAULT_MARK_SIZE = 40;

export function starburstRays(size: number, strokeWidth: number): Ray[] {
  const center = size / 2;
  const outer = center - strokeWidth / 2;
  const inner = size * INNER_RATIO;
  const step = (Math.PI * 2) / RAY_REACH.length;

  return RAY_REACH.map((reach, index) => {
    const angle = ROTATION + step * index;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const length = inner + (outer - inner) * reach;
    return {
      x1: center + cos * inner,
      y1: center + sin * inner,
      x2: center + cos * length,
      y2: center + sin * length,
    };
  });
}
