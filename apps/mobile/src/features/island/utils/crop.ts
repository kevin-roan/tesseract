import type { Corner, FitGeometry, Rect, Size } from "../types";
import { INITIAL_CROP_INSET, MIN_CROP_SIZE } from "./constants";

const clamp = (value: number, min: number, max: number) => {
  "worklet";
  return Math.min(max, Math.max(min, value));
};

/** Letterboxes `image` inside `container` and reports where it lands and at what scale. */
export function fitImage(image: Size, container: Size): FitGeometry {
  if (image.width <= 0 || image.height <= 0 || container.width <= 0 || container.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0, scale: 1 };
  }
  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (container.width - width) / 2, y: (container.height - height) / 2, width, height, scale };
}

export function screenToImage(rect: Rect, fit: FitGeometry): Rect {
  const scale = fit.scale || 1;
  return {
    x: Math.round((rect.x - fit.x) / scale),
    y: Math.round((rect.y - fit.y) / scale),
    width: Math.round(rect.width / scale),
    height: Math.round(rect.height / scale),
  };
}

export function imageToScreen(rect: Rect, fit: FitGeometry): Rect {
  return {
    x: fit.x + rect.x * fit.scale,
    y: fit.y + rect.y * fit.scale,
    width: rect.width * fit.scale,
    height: rect.height * fit.scale,
  };
}

/** Keeps `rect` inside `bounds`, shrinking it first when it does not fit at all. */
export function clampRect(rect: Rect, bounds: Rect, minSize?: number): Rect {
  "worklet";
  const min = Math.min(minSize ?? MIN_CROP_SIZE, bounds.width, bounds.height);
  const width = clamp(rect.width, min, bounds.width);
  const height = clamp(rect.height, min, bounds.height);
  return {
    x: clamp(rect.x, bounds.x, bounds.x + bounds.width - width),
    y: clamp(rect.y, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
}

export function initialCrop(bounds: Rect, inset: number = INITIAL_CROP_INSET): Rect {
  const dx = bounds.width * inset;
  const dy = bounds.height * inset;
  return clampRect({ x: bounds.x + dx, y: bounds.y + dy, width: bounds.width - dx * 2, height: bounds.height - dy * 2 }, bounds);
}

export function moveRect(rect: Rect, dx: number, dy: number, bounds: Rect): Rect {
  "worklet";
  return clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy }, bounds, Math.min(rect.width, rect.height));
}

/** Drags one corner; the opposite corner stays put and the box never goes below `minSize` or outside `bounds`. */
export function resizeFromCorner(rect: Rect, corner: Corner, dx: number, dy: number, bounds: Rect, minSize?: number): Rect {
  "worklet";
  const min = Math.min(minSize ?? MIN_CROP_SIZE, bounds.width, bounds.height);
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const boundsRight = bounds.x + bounds.width;
  const boundsBottom = bounds.y + bounds.height;

  const movesLeft = corner === "topLeft" || corner === "bottomLeft";
  const movesTop = corner === "topLeft" || corner === "topRight";

  const nextLeft = movesLeft ? clamp(left + dx, bounds.x, right - min) : left;
  const nextRight = movesLeft ? right : clamp(right + dx, left + min, boundsRight);
  const nextTop = movesTop ? clamp(top + dy, bounds.y, bottom - min) : top;
  const nextBottom = movesTop ? bottom : clamp(bottom + dy, top + min, boundsBottom);

  return { x: nextLeft, y: nextTop, width: nextRight - nextLeft, height: nextBottom - nextTop };
}

export function isFullImage(rect: Rect, image: Size): boolean {
  return rect.x <= 0 && rect.y <= 0 && rect.width >= image.width && rect.height >= image.height;
}
