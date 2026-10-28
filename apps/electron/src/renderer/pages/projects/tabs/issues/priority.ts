import type { IssuePriority } from "@tesseract/protocol";
import { PRIORITY_BARS, PRIORITY_GEOMETRY } from "./constants";

export interface PriorityBar {
  x: number;
  y: number;
  width: number;
  height: number;
  filled: boolean;
}

export function priorityBars(priority: Exclude<IssuePriority, "urgent">, geometry = PRIORITY_GEOMETRY): PriorityBar[] {
  const { box, bars, barWidth, gap, minHeight, maxHeight } = geometry;
  const total = bars * barWidth + (bars - 1) * gap;
  const left = (box - total) / 2;
  const bottom = (box + maxHeight) / 2;
  const step = bars > 1 ? (maxHeight - minHeight) / (bars - 1) : 0;
  return Array.from({ length: bars }, (_, index) => {
    const height = minHeight + step * index;
    return { x: left + index * (barWidth + gap), y: bottom - height, width: barWidth, height, filled: index < PRIORITY_BARS[priority] };
  });
}
