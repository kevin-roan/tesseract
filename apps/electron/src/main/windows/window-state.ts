import { WINDOW_VISIBLE_MIN } from "../constants";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SavedWindowState {
  bounds: Rect;
  maximized: boolean;
}

export interface WindowSizing {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

export interface RestoredWindow {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseWindowState(raw: unknown): SavedWindowState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as { bounds?: Partial<Rect>; maximized?: unknown };
  const bounds = record.bounds;
  if (!bounds || !finite(bounds.x) || !finite(bounds.y) || !finite(bounds.width) || !finite(bounds.height)) return null;
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  return {
    bounds: { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) },
    maximized: record.maximized === true,
  };
}

function overlap(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

function area(rect: Rect | null): number {
  return rect ? rect.width * rect.height : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function restoreWindow(saved: SavedWindowState | null, workAreas: readonly Rect[], sizing: WindowSizing): RestoredWindow {
  if (!saved) return { width: sizing.width, height: sizing.height, maximized: false };
  const best = workAreas
    .map((workArea) => ({ workArea, shared: overlap(saved.bounds, workArea) }))
    .sort((a, b) => area(b.shared) - area(a.shared))[0];
  const target = best?.workArea;
  const width = clamp(saved.bounds.width, sizing.minWidth, target?.width ?? saved.bounds.width);
  const height = clamp(saved.bounds.height, sizing.minHeight, target?.height ?? saved.bounds.height);
  const titleStrip = { ...saved.bounds, height: Math.min(saved.bounds.height, WINDOW_VISIBLE_MIN.height) };
  const reachable = target ? overlap(titleStrip, target) : null;
  if (!target || !reachable || reachable.width < WINDOW_VISIBLE_MIN.width || reachable.height < WINDOW_VISIBLE_MIN.height / 2) {
    return { width, height, maximized: saved.maximized };
  }
  return {
    x: clamp(saved.bounds.x, target.x, target.x + target.width - width),
    y: clamp(saved.bounds.y, target.y, target.y + target.height - height),
    width,
    height,
    maximized: saved.maximized,
  };
}
