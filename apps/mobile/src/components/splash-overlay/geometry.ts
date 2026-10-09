import type { SkFont } from "@shopify/react-native-skia";

/** Pixel size of `assets/images/splash.png` and the obelisk landmarks on it. */
const SOURCE = { width: 2171, height: 4719 };
const TIP = { x: 1133, y: 2579 };
const SHOULDER = { left: 720, right: 1546, y: 2943 };

export type Point = { x: number; y: number };

export type ObeliskGeometry = {
  tip: Point;
  leftShoulder: Point;
  rightShoulder: Point;
  /** Where the lit and shaded faces meet, from the tip to the bottom edge. */
  ridgeBottom: number;
  scale: number;
};

/** Where the splash image is drawn: its scale and top-left offset. */
type SplashPlacement = { scale: number; dx: number; dy: number; width: number; height: number };

/** Maps the obelisk landmarks onto a splash image drawn at `placement`; the ridge runs to `bottom`. */
function placeObelisk({ scale, dx, dy }: SplashPlacement, bottom: number): ObeliskGeometry {
  const map = (x: number, y: number) => ({
    x: dx + x * scale,
    y: dy + y * scale,
  });

  return {
    tip: map(TIP.x, TIP.y),
    leftShoulder: map(SHOULDER.left, SHOULDER.y),
    rightShoulder: map(SHOULDER.right, SHOULDER.y),
    ridgeBottom: bottom,
    scale,
  };
}

/** Maps the obelisk onto a `cover`-fitted, centered splash — the same fit the native splash uses. */
export function obeliskGeometry(width: number, height: number): ObeliskGeometry {
  const scale = Math.max(width / SOURCE.width, height / SOURCE.height);
  const dx = (width - SOURCE.width * scale) / 2;
  const dy = (height - SOURCE.height * scale) / 2;
  return placeObelisk({ scale, dx, dy, width: SOURCE.width * scale, height: SOURCE.height * scale }, height);
}

export type GlyphLayout = { id: number; x: number }[];

/** Per-glyph x offsets for `text`, centered on `centerX`, with `tracking` (in em) between glyphs. */
export function layoutGlyphs(font: SkFont, text: string, centerX: number, tracking: number) {
  const ids = font.getGlyphIDs(text);
  const widths = font.getGlyphWidths(ids);
  const gap = font.getSize() * tracking;
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * (ids.length - 1);
  let x = centerX - total / 2;
  const glyphs: GlyphLayout = ids.map((id, i) => {
    const glyph = { id, x };
    x += widths[i] + gap;
    return glyph;
  });
  return { glyphs, width: total, left: centerX - total / 2 };
}
