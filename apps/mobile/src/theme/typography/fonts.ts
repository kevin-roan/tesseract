import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

/**
 * Font families.
 *
 * The UI font is Saira, loaded from `@expo-google-fonts/saira` in the root
 * layout. React Native does not synthesise weights for a custom family on
 * Android, so each weight is a separately registered face and the family name
 * carries the weight — use `sansFor(weight)` rather than `fontWeight` when
 * styling text. Serif and mono stay on the platform defaults.
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'Saira_400Regular',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    rounded: 'Saira_500Medium',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Saira_400Regular',
    serif: 'serif',
    rounded: 'Saira_500Medium',
    mono: 'monospace',
  },
  web: {
    sans: 'Saira_400Regular',
    serif: 'var(--font-serif)',
    rounded: 'Saira_500Medium',
    mono: 'var(--font-mono)',
  },
});

export type FontFamily = keyof typeof Fonts;

export const FontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export type FontWeight = keyof typeof FontWeights;

/**
 * The registered Saira face for each weight we ship. Keys match the numeric
 * values in `FontWeights`; keep the two in step when adding a weight, and load
 * the matching face in the root layout.
 */
export const SansFaces: Record<string, string> = {
  '400': 'Saira_400Regular',
  '500': 'Saira_500Medium',
  '600': 'Saira_600SemiBold',
  '700': 'Saira_700Bold',
};

/** Family name for a numeric weight, falling back to regular. */
export function sansFor(weight: TextStyle['fontWeight']): string {
  return SansFaces[String(weight)] ?? SansFaces['400'];
}

/**
 * Letter spacing. Large text needs negative tracking to stay optically even;
 * small uppercase labels need positive tracking to stay readable.
 *
 * Saira is a condensed-ish grotesque and already sits tight, so the display
 * tracking here is gentler than it would be for a system font.
 */
export const LetterSpacing = {
  tighter: -0.6,
  tight: -0.3,
  normal: 0,
  wide: 0.4,
  wider: 1.2,
} as const;
