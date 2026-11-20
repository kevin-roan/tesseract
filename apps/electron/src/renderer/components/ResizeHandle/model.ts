import { SIDEBAR_WIDTH } from "./constants";

export interface WidthBounds {
  min: number;
  max: number;
}

export type ResizeAxis = "x" | "y";

export interface ResizeKeys {
  decrease: string;
  increase: string;
}

export function resizeKeys(axis: ResizeAxis = "x", reverse = false): ResizeKeys {
  const [low, high] = axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
  return reverse ? { decrease: high, increase: low } : { decrease: low, increase: high };
}

export function resizeWidth(startWidth: number, offset: number, zoom: number, bounds: WidthBounds = SIDEBAR_WIDTH): number {
  const scale = zoom > 0 ? zoom : 1;
  return Math.round(Math.min(Math.max(startWidth + offset / scale, bounds.min), bounds.max));
}

export function keyboardWidth(key: string, width: number, step: number, bounds: WidthBounds = SIDEBAR_WIDTH, keys: ResizeKeys = resizeKeys()): number | null {
  if (key === keys.decrease) return resizeWidth(width, -step, 1, bounds);
  if (key === keys.increase) return resizeWidth(width, step, 1, bounds);
  if (key === "Home") return bounds.min;
  if (key === "End") return bounds.max;
  return null;
}
