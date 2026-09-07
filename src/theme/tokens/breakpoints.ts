/**
 * Width breakpoints and device classes.
 *
 * Values are in dp (density-independent pixels), matching the width reported by
 * `useWindowDimensions()`. The scale covers the full phone -> tablet range:
 *
 *   xs  320-379   compact phones (iPhone SE, Galaxy A0x)
 *   sm  380-599   standard/large phones (iPhone 15/Pro Max, Pixel)
 *   md  600-839   phone landscape, small tablets (iPad mini portrait)
 *   lg  840-1179  tablets portrait (iPad Air/Pro 11")
 *   xl  1180+     tablets landscape, desktop web
 */

export const Breakpoints = {
  xs: 0,
  sm: 380,
  md: 600,
  lg: 840,
  xl: 1180,
} as const;

export type Breakpoint = keyof typeof Breakpoints;

/** Ordered smallest -> largest. Used for resolution and `up`/`down` checks. */
export const BreakpointOrder = ['xs', 'sm', 'md', 'lg', 'xl'] as const satisfies readonly Breakpoint[];

/**
 * A device is treated as a tablet when its *shortest* side is >= 600dp, so the
 * classification does not flip when the user rotates the device.
 */
export const TabletMinShortSide = 600;

export type DeviceClass = 'phone' | 'phoneLarge' | 'tablet' | 'tabletLarge';

export function resolveBreakpoint(width: number): Breakpoint {
  let match: Breakpoint = 'xs';
  for (const key of BreakpointOrder) {
    if (width >= Breakpoints[key]) match = key;
  }
  return match;
}

export function resolveDeviceClass(width: number, height: number): DeviceClass {
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  if (shortSide >= TabletMinShortSide) {
    return longSide >= 1100 ? 'tabletLarge' : 'tablet';
  }
  return shortSide >= 400 ? 'phoneLarge' : 'phone';
}

export function isTablet(width: number, height: number): boolean {
  return Math.min(width, height) >= TabletMinShortSide;
}

/** True when `width` is at or above the given breakpoint. */
export function isBreakpointUp(width: number, breakpoint: Breakpoint): boolean {
  return width >= Breakpoints[breakpoint];
}

/** True when `width` is below the given breakpoint. */
export function isBreakpointDown(width: number, breakpoint: Breakpoint): boolean {
  return width < Breakpoints[breakpoint];
}

/**
 * A value that may be declared per breakpoint. Missing breakpoints fall back to
 * the nearest smaller one that is defined:
 *
 *   { xs: 1, lg: 2 } -> xs:1  sm:1  md:1  lg:2  xl:2
 */
export type Responsive<T> = T | Partial<Record<Breakpoint, T>>;

function isBreakpointMap<T>(value: Responsive<T>): value is Partial<Record<Breakpoint, T>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.keys(value).every((key) => key in Breakpoints);
}

export function resolveResponsive<T>(value: Responsive<T>, breakpoint: Breakpoint): T | undefined {
  if (!isBreakpointMap(value)) return value;

  let resolved: T | undefined;
  for (const key of BreakpointOrder) {
    if (value[key] !== undefined) resolved = value[key];
    if (key === breakpoint) break;
  }
  return resolved;
}
