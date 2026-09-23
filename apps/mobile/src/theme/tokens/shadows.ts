import { Platform, type ViewStyle } from 'react-native';

/**
 * Elevation levels. Android maps to `elevation`, iOS/web to a shadow; the two
 * are tuned to read as the same depth. Shadows are near-invisible on a dark
 * background — pair `level2+` with `surfaceElevated` there rather than relying
 * on the shadow alone.
 */
function elevation(level: number, radius: number, offsetY: number, opacity: number): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation: level },
    web: { boxShadow: `0 ${offsetY}px ${radius}px rgba(0, 0, 0, ${opacity})` } as ViewStyle,
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: offsetY },
      shadowRadius: radius,
      shadowOpacity: opacity,
    },
  })!;
}

export const Shadows = {
  /** Flat — the default. */
  none: {} as ViewStyle,
  /** Cards, list rows lifted off the background. */
  level1: elevation(2, 6, 1, 0.08),
  /** Menus, popovers, floating composer. */
  level2: elevation(6, 14, 4, 0.12),
  /** Bottom sheets, FAB. */
  level3: elevation(12, 24, 8, 0.16),
  /** Modals over a scrim. */
  level4: elevation(24, 40, 14, 0.22),
} as const;

export type ShadowToken = keyof typeof Shadows;
