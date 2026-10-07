import { LOOP_MS } from "../../theme/motion";

export const DOT_SPHERE = {
  dots: 24,
  depthBands: 5,
  framesPerTurn: 90,
  periodMs: LOOP_MS.dotSphereTurn,
  minDotRadius: 1,
  dotRadiusDivisor: 20,
  nearScale: 0.55,
  farScale: 0.45,
  opacityFloor: 0.12,
  opacityRange: 0.88,
} as const;
