import { Skia, type SkPath } from "@shopify/react-native-skia";

import type { ObeliskGeometry } from "@/components/splash-overlay/geometry";
import { Palette } from "@/theme";

export const MONOLITH_EGG = {
  /** Taps in a row that wake the monolith, and how long a pause between them resets the count. */
  taps: 7,
  tapWindow: 1200,
  /** How long the monolith stays awake after the last touch. */
  awakeFor: 12000,
  /** Gap between blinks while awake. */
  blinkEvery: 2800,
  /** Degrees it wobbles on each tap while asleep. */
  wobble: 3,
  hearts: 3,
  sparks: 6,
  colors: {
    ink: "#2b2724",
    cheek: "#f4a6b8",
    heart: "#ff8fab",
    spark: Palette.clay[400],
  },
};

/** Box for the About monolith: a little taller than wide, so the face has room under the roof. */
export function eggBox(size: number) {
  return { width: size, height: size * 1.15 };
}

/** Where the eyes look, -1…1 each way, for a finger at `x`, `y` in a `width` × `height` box. */
export function lookAt(x: number, y: number, width: number, height: number) {
  "worklet";
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  return { x: clamp((x / width) * 2 - 1), y: clamp((y / height) * 2 - 1) };
}

/** Where the face sits on the lit side of the obelisk, and the unit its features are measured in. */
export function obeliskFace({ tip, leftShoulder }: ObeliskGeometry) {
  const unit = (tip.x - leftShoulder.x) / 5;
  return {
    x: (leftShoulder.x + tip.x) / 2,
    y: leftShoulder.y + unit * 3,
    unit,
  };
}

/** A heart `size` across, centred on the origin. */
export function heartPath(size: number): SkPath {
  const s = size / 2;
  const path = Skia.Path.Make();
  path.moveTo(0, -s * 0.45);
  path.cubicTo(0, -s * 0.9, -s, -s, -s, -s * 0.3);
  path.cubicTo(-s, s * 0.2, -s * 0.3, s * 0.5, 0, s * 0.85);
  path.cubicTo(s * 0.3, s * 0.5, s, s * 0.2, s, -s * 0.3);
  path.cubicTo(s, -s, 0, -s * 0.9, 0, -s * 0.45);
  path.close();
  return path;
}

/** The two `^` strokes of a squint, `rx` wide and `ry` tall about the origin. */
export function squintPath(rx: number, ry: number): SkPath {
  const path = Skia.Path.Make();
  path.moveTo(-rx, ry * 0.35);
  path.lineTo(0, -ry * 0.45);
  path.lineTo(rx, ry * 0.35);
  return path;
}

/** A cat's `ω` mouth `width` across, its top at the origin. */
export function mouthPath(width: number): SkPath {
  const w = width / 2;
  const path = Skia.Path.Make();
  path.moveTo(-w, 0);
  path.quadTo(-w / 2, w * 0.9, 0, 0);
  path.quadTo(w / 2, w * 0.9, w, 0);
  return path;
}

/** Height, drift and fade of heart `index` at `progress` (0–1) through a burst. */
export function heartPose(progress: number, index: number, unit: number) {
  "worklet";
  const p = Math.max(0, Math.min(1, (progress - index * 0.15) / 0.7));
  return {
    x: (index - 1) * unit * 1.6 + Math.sin(p * Math.PI * 2 + index * 2) * unit * 0.8,
    y: -p * unit * 9,
    opacity: Math.sin(p * Math.PI),
  };
}

/** Appends `count` sparks flying out from `x`, `y` at `progress` (0–1), up to `reach` away. */
export function traceSparks(
  path: { addCircle(x: number, y: number, r: number): unknown },
  x: number,
  y: number,
  progress: number,
  count: number,
  reach: number,
) {
  "worklet";
  if (progress >= 1) return;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const distance = reach * (0.3 + progress * 0.7);
    path.addCircle(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 1.2 * (1 - progress));
  }
}
