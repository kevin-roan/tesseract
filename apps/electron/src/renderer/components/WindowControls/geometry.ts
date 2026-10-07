import { GLYPH } from "./constants";

export type GlyphName = "minimize" | "maximize" | "restore" | "close";

const n = (value: number) => Number(value.toFixed(3)).toString();

export function glyphOrigin(canvas: number = GLYPH.canvas, box: number = GLYPH.box): number {
  return Math.floor((canvas - box) / 2) + 0.5;
}

export function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M${n(x + r)} ${n(y)}`,
    `H${n(x + width - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(x + width)} ${n(y + r)}`,
    `V${n(y + height - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(x + width - r)} ${n(y + height)}`,
    `H${n(x + r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + height - r)}`,
    `V${n(y + r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}`,
    "Z",
  ].join("");
}

export function glyphPaths(canvas: number = GLYPH.canvas): Record<GlyphName, string> {
  const x = glyphOrigin(canvas);
  const y = x;
  const span = GLYPH.span;
  const offset = GLYPH.restoreOffset;
  const front = span - offset;
  return {
    minimize: `M${n(x)} ${n(y + 5)}H${n(x + span)}`,
    maximize: roundedRectPath(x, y, span, span, GLYPH.radius),
    restore: [
      roundedRectPath(x, y + offset, front, front, GLYPH.radius),
      `M${n(x + offset)} ${n(y + GLYPH.restoreReturn)}V${n(y)}H${n(x + span)}V${n(y + front)}H${n(x + front + 0.5)}`,
    ].join(""),
    close: `M${n(x)} ${n(y)}L${n(x + span)} ${n(y + span)}M${n(x + span)} ${n(y)}L${n(x)} ${n(y + span)}`,
  };
}

export const GLYPH_PATHS = glyphPaths();
