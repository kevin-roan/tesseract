import { Platform } from 'react-native';

import type { Breakpoint, DeviceClass } from './breakpoints';

/**
 * Reading measure. Text lines longer than ~700dp are tiring, so content is
 * centered inside this width once the window is wider than it — which is what
 * keeps a chat transcript readable on an iPad in landscape.
 */
export const MaxContentWidth: Record<Breakpoint, number> = {
  xs: Infinity,
  sm: Infinity,
  md: 640,
  lg: 720,
  xl: 800,
};

/** Chat bubbles never span the full measure. */
export const MaxBubbleWidthRatio: Record<DeviceClass, number> = {
  phone: 0.86,
  phoneLarge: 0.82,
  tablet: 0.72,
  tabletLarge: 0.66,
};

/** Width of a persistent conversation sidebar. Null = use a drawer instead. */
export const SidebarWidth: Record<DeviceClass, number | null> = {
  phone: null,
  phoneLarge: null,
  tablet: 288,
  tabletLarge: 320,
};

/**
 * Minimum touch target: 44 on iOS (HIG), 48 on Android (Material). Never make a
 * tappable element smaller — use `HitSlop` to extend the target instead.
 */
export const MinTouchTarget = Platform.select({ ios: 44, default: 48 });

export const HitSlop = {
  sm: { top: 6, bottom: 6, left: 6, right: 6 },
  md: { top: 10, bottom: 10, left: 10, right: 10 },
  lg: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

export const ControlHeight = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
} as const;

/** Status and unread dots. */
export const DotSize = {
  sm: 6,
  md: 8,
} as const;

/**
 * Opacity steps. `pressed` dims a tapped row or card, `pressedSoft` a large
 * tappable surface, `disabled` an inert control, `muted` secondary marks.
 */
export const Opacity = {
  muted: 0.45,
  disabled: 0.5,
  pressed: 0.7,
  pressedSoft: 0.85,
} as const;

export const IconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const AvatarSize = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 72,
} as const;

/** Number of grid columns for card layouts (suggestion chips, tool gallery). */
export const GridColumns: Record<Breakpoint, number> = {
  xs: 1,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
};

/** Windows shorter than this (dp) are compact: fixed layouts drop secondary detail. */
export const CompactHeight = 700;

/** Stacking order. Keep every absolute overlay in this list. */
export const ZIndex = {
  base: 0,
  raised: 1,
  sticky: 10,
  drawer: 20,
  header: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
  tooltip: 70,
  splash: 100,
} as const;
