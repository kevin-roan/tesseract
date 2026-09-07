import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

/**
 * Font families. iOS uses the system design descriptors, web resolves the CSS
 * variables declared in `src/global.css`, Android falls back to the platform
 * defaults. No custom font files are loaded, so there is nothing to await at
 * startup — see `expo-font` if that changes.
 */
export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
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
 * Letter spacing. Large text needs negative tracking to stay optically even;
 * small uppercase labels need positive tracking to stay readable.
 */
export const LetterSpacing = {
  tighter: -0.8,
  tight: -0.4,
  normal: 0,
  wide: 0.4,
  wider: 1.2,
} as const;
