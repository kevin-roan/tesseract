import type { ChartBucket } from "../types";
import { stackValues } from "./series";

export const MARK = {
  maxBarWidth: 24,
  gap: 2,
  radius: 4,
} as const;

export type RectSegment = {
  seriesIndex: number;
  y: number;
  height: number;
  rounded: boolean;
};

export type BarGeometry = {
  index: number;
  x: number;
  width: number;
  segments: RectSegment[];
};

export type Tick = { value: number; y: number };

export type BarLayout = {
  bars: BarGeometry[];
  ticks: Tick[];
  band: number;
};

/**
 * Column positions for a stacked bar chart drawn inside a `width` × `height` plot. Bars are capped at 24px, touching
 * segments are separated by a 2px gap, and only the top segment of each bar gets the rounded data end.
 */
export function layoutStackedBars(
  buckets: readonly ChartBucket[],
  ticks: readonly number[],
  width: number,
  height: number,
): BarLayout {
  const count = buckets.length;
  const top = ticks[ticks.length - 1] || 1;
  const band = count > 0 ? width / count : 0;
  const barWidth = Math.max(1, Math.min(MARK.maxBarWidth, band - MARK.gap));
  const y = (value: number) => height - (value / top) * height;

  const bars = buckets.map((bucket, index) => {
    const visible = stackValues(bucket.values).filter((segment) => segment.value > 0);
    const segments: RectSegment[] = [];
    visible.forEach((segment, order) => {
      const yTop = y(segment.y1);
      const bottomGap = order === 0 ? 0 : MARK.gap;
      const segmentHeight = y(segment.y0) - yTop - bottomGap;
      if (segmentHeight <= 0) return;
      segments.push({ seriesIndex: segment.seriesIndex, y: yTop, height: segmentHeight, rounded: false });
    });
    if (segments.length > 0) segments[segments.length - 1].rounded = true;
    return { index, x: index * band + (band - barWidth) / 2, width: barWidth, segments };
  });

  return { bars, ticks: ticks.map((value) => ({ value, y: y(value) })), band };
}

/** SVG path for a rect with rounded top corners and a square base. */
export function roundedTopRect(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  return [
    `M${x},${y + height}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + width - r},${y}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `L${x + width},${y + height}`,
    "Z",
  ].join(" ");
}
