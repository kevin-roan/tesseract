/**
 * 4pt spacing scale. Use the semantic names everywhere; raw numbers in styles
 * are the thing this file exists to remove.
 */

import { moderateScale } from '../responsive';
import type { Breakpoint } from './breakpoints';

export const Spacing = {
  none: 0,
  /** 2 — hairline separation, icon nudges */
  xxs: 2,
  /** 4 — inside chips and badges */
  xs: 4,
  /** 8 — between tightly related items */
  sm: 8,
  /** 12 — inside compact controls */
  md: 12,
  /** 16 — default gutter and card padding */
  base: 16,
  /** 20 */
  lg: 20,
  /** 24 — between sections on a phone */
  xl: 24,
  /** 32 */
  '2xl': 32,
  /** 40 */
  '3xl': 40,
  /** 48 — between sections on a tablet */
  '4xl': 48,
  /** 64 */
  '5xl': 64,
  /** 80 — empty-state and onboarding breathing room */
  '6xl': 80,
} as const;

export type SpacingToken = keyof typeof Spacing;

/**
 * Horizontal padding from the screen edge. Grows with the viewport so content
 * is not glued to the bezel on a tablet.
 */
export const ScreenGutter: Record<Breakpoint, number> = {
  xs: 16,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
};

/**
 * Vertical rhythm between major sections, per breakpoint.
 */
export const SectionGap: Record<Breakpoint, number> = {
  xs: 24,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
};

/** Returns the spacing scale scaled for the current window. */
export function createSpacing(width: number, height: number) {
  const entries = Object.entries(Spacing).map(([key, value]) => [
    key,
    value === 0 ? 0 : moderateScale(value, width, height, 0.35),
  ]);
  return Object.fromEntries(entries) as Record<SpacingToken, number>;
}
