import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { runtime } from "../../app/runtime";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const OBSERVED_ATTRIBUTES = ["data-scheme", "data-reduced-motion", "style", "class"];

export interface CanvasSize {
  width: number;
  height: number;
  dpr: number;
}

function subscribeRoot(callback: () => void): () => void {
  const root = globalThis.document?.documentElement;
  const media = globalThis.matchMedia?.(REDUCED_MOTION_QUERY);
  media?.addEventListener?.("change", callback);
  const fonts = globalThis.document?.fonts;
  fonts?.addEventListener?.("loadingdone", callback);
  if (!root || typeof MutationObserver === "undefined") return () => media?.removeEventListener?.("change", callback);
  const observer = new MutationObserver(callback);
  observer.observe(root, { attributes: true, attributeFilter: OBSERVED_ATTRIBUTES });
  return () => {
    observer.disconnect();
    media?.removeEventListener?.("change", callback);
    fonts?.removeEventListener?.("loadingdone", callback);
  };
}

function rootSignature(): string {
  const root = globalThis.document?.documentElement;
  if (!root) return "";
  const fontsReady = globalThis.document?.fonts?.status ?? "loaded";
  return `${root.dataset.scheme ?? ""}|${root.dataset.reducedMotion ?? ""}|${reducedMotion()}|${fontsReady}`;
}

export function useThemeSignature(): string {
  return useSyncExternalStore(subscribeRoot, rootSignature, () => "");
}

export function reducedMotion(): boolean {
  if (runtime.reducedMotion) return true;
  if (globalThis.document?.documentElement.dataset.reducedMotion === "true") return true;
  return globalThis.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
}

export function useReducedMotionPreference(): boolean {
  useThemeSignature();
  return reducedMotion();
}

export function useCanvasSize(ref: RefObject<HTMLElement | null>, fallbackHeight: number): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: fallbackHeight, dpr: 1 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const dpr = globalThis.devicePixelRatio || 1;
      setSize((previous) =>
        previous.width === rect.width && previous.height === rect.height && previous.dpr === dpr
          ? previous
          : { width: rect.width, height: rect.height || fallbackHeight, dpr },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, fallbackHeight]);
  return size;
}

export function prepareCanvas(canvas: HTMLCanvasElement, size: CanvasSize): CanvasRenderingContext2D | null {
  const pixelWidth = Math.max(1, Math.round(size.width * size.dpr));
  const pixelHeight = Math.max(1, Math.round(size.height * size.dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext("2d");
  } catch {
    return null;
  }
  if (!context) return null;
  context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  context.clearRect(0, 0, size.width, size.height);
  return context;
}

export function cssColor(element: Element, token: string): string {
  const name = token.startsWith("--") ? token : `--to-${token}`;
  return getComputedStyle(element).getPropertyValue(name).trim();
}

export function withAlpha(color: string, alpha: number): string {
  const rgba = parseColor(color);
  if (!rgba) return color;
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${Math.max(0, Math.min(1, rgba[3] * alpha))})`;
}

export function parseColor(color: string): [number, number, number, number] | null {
  const value = color.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const full = hex.length === 3 || hex.length === 4 ? [...hex].map((c) => c + c).join("") : hex;
    if (full.length !== 6 && full.length !== 8) return null;
    const channel = (index: number) => Number.parseInt(full.slice(index, index + 2), 16);
    return [channel(0), channel(2), channel(4), full.length === 8 ? channel(6) / 255 : 1];
  }
  const match = /^rgba?\(([^)]+)\)$/.exec(value);
  if (!match?.[1]) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
}

export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
