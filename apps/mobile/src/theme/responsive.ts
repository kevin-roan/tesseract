/**
 * Pure scaling helpers. Nothing here reads dimensions itself — the current
 * window size is always passed in, so these can be used inside `StyleSheet`
 * factories, worklets and tests. Use `useResponsive()` for the React binding.
 */

import { PixelRatio } from 'react-native';

import { isTablet } from './tokens/breakpoints';

/** Design baseline: iPhone 13/14/15 logical size. */
export const BaseWidth = 390;
export const BaseHeight = 844;

/** Baseline used once the device is classified as a tablet (iPad 11" portrait). */
export const BaseTabletWidth = 834;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Rounds to the nearest physical pixel so borders and hairlines stay crisp. */
export function roundToPixel(value: number): number {
  return PixelRatio.roundToNearestPixel(value);
}

/**
 * Raw width ratio against the design baseline, clamped so that neither a 320dp
 * phone nor a 1366dp tablet produces absurd values.
 */
export function scaleRatio(width: number, height: number): number {
  const baseline = isTablet(width, height) ? BaseTabletWidth : BaseWidth;
  return clamp(width / baseline, 0.85, 1.35);
}

/** Linear scale — for things that should track screen width 1:1 (illustrations, hero art). */
export function scale(size: number, width: number, height: number): number {
  return roundToPixel(size * scaleRatio(width, height));
}

/**
 * Dampened scale — the default for spacing, radii and type. A `factor` of 0
 * disables scaling entirely, 1 makes it linear. 0.5 grows a 16dp value to ~18dp
 * on a large tablet instead of ~21dp.
 */
export function moderateScale(size: number, width: number, height: number, factor = 0.5): number {
  return roundToPixel(size + (size * scaleRatio(width, height) - size) * factor);
}

/**
 * Type scaling is deliberately tighter than layout scaling: OS-level Dynamic
 * Type / font scale already enlarges text for accessibility, so the layout
 * multiplier only compensates for the extra reading distance on tablets.
 */
export function scaleFont(size: number, width: number, height: number): number {
  return roundToPixel(size * clamp(scaleRatio(width, height), 0.95, 1.15));
}

/**
 * Caps the OS font scale for elements that cannot reflow (tab labels, badges,
 * single-line buttons). Pass the result to `<Text maxFontSizeMultiplier>`.
 */
export const MaxFontSizeMultiplier = {
  /** Long-form content — let it grow all the way. */
  content: 2.4,
  /** Headings and titles. */
  heading: 1.6,
  /** Copy on screens that cannot scroll. */
  fixed: 1.35,
  /** Chrome that must stay on one line. */
  chrome: 1.2,
} as const;
