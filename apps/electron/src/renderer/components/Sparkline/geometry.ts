import { SPARKLINE } from "./constants";

export interface SparklineGeometryInput {
  values: readonly number[];
  width: number;
  height: number;
  maxPoints: number;
  min: number | null;
  max: number | null;
}

export function sparklinePoints({ values, width, height, maxPoints, min, max }: SparklineGeometryInput): [number, number][] {
  const visible = values.slice(-Math.max(1, maxPoints));
  if (visible.length < 2) return [];
  const low = min ?? Math.min(...visible);
  const high = max ?? Math.max(...visible);
  const span = high - low || 1;
  const step = width / (maxPoints > 1 ? maxPoints - 1 : visible.length - 1);
  const offset = width - step * (visible.length - 1);
  const inset = SPARKLINE.lineWidth;
  return visible.map((value, index) => [
    offset + index * step,
    inset + (height - 2 * inset) * (1 - (Math.min(Math.max(value, low), high) - low) / span),
  ]);
}
