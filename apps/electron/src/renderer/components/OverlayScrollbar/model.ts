import { OVERLAY_SCROLLBAR } from "./constants";

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface RailBox {
  top: number;
  left: number;
  width: number;
  height: number;
  thumb: number;
}

export function thumbLength({ scrollHeight, clientHeight }: ScrollMetrics): number | null {
  if (scrollHeight - clientHeight <= OVERLAY_SCROLLBAR.overflowSlackPx || clientHeight <= 0) return null;
  const track = Math.max(0, clientHeight - OVERLAY_SCROLLBAR.marginPx * 2);
  return Math.min(track, Math.max(OVERLAY_SCROLLBAR.minThumbPx, (track * clientHeight) / scrollHeight));
}

export function thumbOffset(metrics: ScrollMetrics, thumb: number): number {
  const range = metrics.scrollHeight - metrics.clientHeight;
  const track = Math.max(0, metrics.clientHeight - OVERLAY_SCROLLBAR.marginPx * 2);
  const progress = range > 0 ? Math.min(1, Math.max(0, metrics.scrollTop / range)) : 0;
  return OVERLAY_SCROLLBAR.marginPx + progress * Math.max(0, track - thumb);
}

export function scrollPerThumbPixel(metrics: ScrollMetrics, thumb: number): number {
  const track = Math.max(0, metrics.clientHeight - OVERLAY_SCROLLBAR.marginPx * 2);
  const free = track - thumb;
  return free > 0 ? (metrics.scrollHeight - metrics.clientHeight) / free : 0;
}

export function wheelPixels(event: Pick<WheelEvent, "deltaY" | "deltaMode">, pageHeight: number): number {
  if (event.deltaMode === 1) return event.deltaY * OVERLAY_SCROLLBAR.lineHeightPx;
  if (event.deltaMode === 2) return event.deltaY * pageHeight;
  return event.deltaY;
}

export function sameBox(a: RailBox | null, b: RailBox | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height && a.thumb === b.thumb;
}
