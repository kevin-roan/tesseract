import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  isBreakpointDown,
  isBreakpointUp,
  isTablet,
  resolveBreakpoint,
  resolveDeviceClass,
  resolveResponsive,
  type Breakpoint,
  type Responsive,
} from '@/theme/tokens/breakpoints';

/**
 * Viewport state, recomputed on rotation, split view and web resize.
 *
 *   const { isTablet, select } = useResponsive();
 *   const columns = select({ xs: 1, md: 2, xl: 4 }) ?? 1;
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const breakpoint = resolveBreakpoint(width);

    return {
      width,
      height,
      breakpoint,
      device: resolveDeviceClass(width, height),
      isTablet: isTablet(width, height),
      isPhone: !isTablet(width, height),
      isLandscape: width > height,
      /** Picks the value declared for the current breakpoint, falling back down the scale. */
      select: <T,>(value: Responsive<T>) => resolveResponsive(value, breakpoint),
      /** `up('md')` — at or above that breakpoint. */
      up: (target: Breakpoint) => isBreakpointUp(width, target),
      /** `down('md')` — strictly below that breakpoint. */
      down: (target: Breakpoint) => isBreakpointDown(width, target),
    };
  }, [width, height]);
}
