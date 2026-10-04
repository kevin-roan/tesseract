import { Skia } from "@shopify/react-native-skia";

/** Canvas height and obelisk proportions, taken from `assets/images/splash.png`. The canvas spans the screen width. */
export const MONOLITH = {
  height: 280,
  /** Body width; the splash obelisk is ~826px wide with a ~364px roof. */
  bodyWidth: 52,
  roofHeight: 23,
  tipY: 118,
} as const;

export function monolithPaths(width: number) {
  const { height, bodyWidth, roofHeight, tipY } = MONOLITH;
  const cx = width / 2;
  const left = cx - bodyWidth / 2;
  const right = cx + bodyWidth / 2;
  const shoulderY = tipY + roofHeight;

  const face = (x: number) => {
    const path = Skia.Path.Make();
    path.moveTo(cx, tipY);
    path.lineTo(x, shoulderY);
    path.lineTo(x, height);
    path.lineTo(cx, height);
    path.close();
    return path;
  };

  const edge = (x: number) => {
    const path = Skia.Path.Make();
    path.moveTo(x, shoulderY);
    path.lineTo(cx, tipY);
    return path;
  };

  return {
    lit: face(left),
    shade: face(right),
    litRoof: edge(left),
    shadeRoof: edge(right),
    tip: { x: cx, y: tipY },
    shoulderY,
    left,
    right,
  };
}
