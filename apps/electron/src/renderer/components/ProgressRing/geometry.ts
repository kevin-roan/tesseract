import { RING } from "./constants";

export const clampFraction = (value: number | null | undefined): number =>
  value === null || value === undefined || !Number.isFinite(value) ? 0 : Math.min(1, Math.max(0, value));

export const percentText = (progress: number): string => `${Math.round(clampFraction(progress) * 100)}%`;

export function ringGeometry(size: number, thickness: number) {
  const center = size / 2;
  return { center, radius: (size - thickness) / 2 };
}

export function arcDash(progress: number): string {
  const length = clampFraction(progress) * RING.pathLength;
  return `${length} ${RING.pathLength}`;
}
