import { SIDEBAR_WIDTH } from "./constants";

export interface WidthBounds {
  min: number;
  max: number;
}

export function resizeWidth(startWidth: number, offset: number, zoom: number, bounds: WidthBounds = SIDEBAR_WIDTH): number {
  const scale = zoom > 0 ? zoom : 1;
  return Math.round(Math.min(Math.max(startWidth + offset / scale, bounds.min), bounds.max));
}

export function keyboardWidth(key: string, width: number, step: number, bounds: WidthBounds = SIDEBAR_WIDTH): number | null {
  if (key === "ArrowLeft") return resizeWidth(width, -step, 1, bounds);
  if (key === "ArrowRight") return resizeWidth(width, step, 1, bounds);
  if (key === "Home") return bounds.min;
  if (key === "End") return bounds.max;
  return null;
}
