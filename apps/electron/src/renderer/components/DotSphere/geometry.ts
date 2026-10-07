import { DOT_SPHERE } from "./constants";

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const TURN = Math.PI * 2;

export interface SpherePoint {
  x: number;
  y: number;
  z: number;
}

export interface SphereDot {
  x: number;
  y: number;
  radius: number;
  band: number;
}

export function spherePoints(count: number): SpherePoint[] {
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - ((index + 0.5) / count) * 2;
    const ring = Math.sqrt(1 - y * y);
    const angle = index * GOLDEN_ANGLE;
    return { x: Math.cos(angle) * ring, y, z: Math.sin(angle) * ring };
  });
}

export function bandOpacity(band: number): number {
  return DOT_SPHERE.opacityFloor + ((band + 0.5) / DOT_SPHERE.depthBands) * DOT_SPHERE.opacityRange;
}

export function sphereDots(points: readonly SpherePoint[], angle: number, center: number, radius: number, dotRadius: number): SphereDot[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map((point) => {
    const depth = (point.z * cos - point.x * sin + 1) / 2;
    return {
      x: center + (point.x * cos + point.z * sin) * radius,
      y: center - point.y * radius,
      radius: dotRadius * (DOT_SPHERE.farScale + depth * DOT_SPHERE.nearScale),
      band: Math.min(DOT_SPHERE.depthBands - 1, Math.floor(depth * DOT_SPHERE.depthBands)),
    };
  });
}

export function frameAngle(ms: number, periodMs: number): number {
  const frames = DOT_SPHERE.framesPerTurn;
  const frame = (((Math.floor((ms / periodMs) * frames) % frames) + frames) % frames);
  return (frame / frames) * TURN;
}

export function dotRadiusFor(size: number): number {
  return Math.max(DOT_SPHERE.minDotRadius, size / DOT_SPHERE.dotRadiusDivisor);
}
