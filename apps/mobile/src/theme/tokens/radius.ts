import { moderateScale } from '../responsive';

export const Radius = {
  none: 0,
  /** 4 — inline code, tags */
  xs: 4,
  /** 8 — inputs, small buttons */
  sm: 8,
  /** 12 — cards, list rows */
  md: 12,
  /** 16 — sheets, message bubbles */
  lg: 16,
  /** 20 */
  xl: 20,
  /** 28 — modal corners */
  '2xl': 28,
  /** 32 — hero panels */
  '3xl': 32,
  /** 22 — the white cards and grouped lists screens are built from */
  card: 22,
  /** 36 — top corners of bottom sheets */
  sheet: 36,
  /** Chips, segments and pill buttons */
  pill: 999,
  /** Pills, avatars, FABs */
  full: 999,
} as const;

export type RadiusToken = keyof typeof Radius;

export const BorderWidth = {
  none: 0,
  /** Sub-pixel divider — resolved against the device pixel ratio at use site. */
  hairline: 0.5,
  thin: 1,
  thick: 2,
  focus: 3,
} as const;

export function createRadius(width: number, height: number) {
  const entries = Object.entries(Radius).map(([key, value]) => [
    key,
    value >= 999 || value === 0 ? value : moderateScale(value, width, height, 0.3),
  ]);
  return Object.fromEntries(entries) as Record<RadiusToken, number>;
}
