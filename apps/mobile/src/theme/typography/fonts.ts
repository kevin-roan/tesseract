import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

/**
 * Font families.
 *
 * Headings, buttons and numbers use Exo 2 (`display`); reading text uses Noto
 * Sans (`sans`). Both are loaded from `@expo-google-fonts` in the root layout.
 * React Native does not synthesise weights for a custom family on Android, so
 * each weight is a separately registered face and the family name carries the
 * weight — use `sansFor(weight)` / `displayFor(weight)` rather than
 * `fontWeight` when styling text. Code and terminals use Geist Mono; serif stays
 * on the platform default.
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'NotoSans_400Regular',
    display: 'Exo2_400Regular',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    rounded: 'Exo2_500Medium',
    mono: 'GeistMono_400Regular',
  },
  default: {
    sans: 'NotoSans_400Regular',
    display: 'Exo2_400Regular',
    serif: 'serif',
    rounded: 'Exo2_500Medium',
    mono: 'GeistMono_400Regular',
  },
  web: {
    sans: 'NotoSans_400Regular',
    display: 'Exo2_400Regular',
    serif: 'var(--font-serif)',
    rounded: 'Exo2_500Medium',
    mono: 'var(--font-mono)',
  },
});

export type FontFamily = keyof typeof Fonts;

export const FontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export type FontWeight = keyof typeof FontWeights;

/**
 * The registered faces for each weight we ship. Keys match the numeric values
 * in `FontWeights`; keep them in step when adding a weight, and load the
 * matching face in `useAppReady`.
 */
export const SansFaces: Record<string, string> = {
  '400': 'NotoSans_400Regular',
  '500': 'NotoSans_500Medium',
  '600': 'NotoSans_600SemiBold',
  '700': 'NotoSans_700Bold',
};

export const DisplayFaces: Record<string, string> = {
  '400': 'Exo2_400Regular',
  '500': 'Exo2_500Medium',
  '600': 'Exo2_600SemiBold',
  '700': 'Exo2_700Bold',
  '800': 'Exo2_800ExtraBold',
};

export const MonoFaces: Record<string, string> = {
  '400': 'GeistMono_400Regular',
  '500': 'GeistMono_500Medium',
  '600': 'GeistMono_600SemiBold',
  '700': 'GeistMono_700Bold',
  '800': 'GeistMono_700Bold',
};

/** Poppins faces for the island, which keeps its own geometric face regardless of scheme. */
export const PoppinsFaces: Record<string, string> = {
  '400': 'Poppins_400Regular',
  '500': 'Poppins_500Medium',
  '600': 'Poppins_600SemiBold',
  '700': 'Poppins_700Bold',
  '800': 'Poppins_700Bold',
};

/**
 * The face set a scheme draws its text in. `classic` pairs Exo 2 headings with
 * Noto Sans copy; `mono` sets every variant, code included, in Geist Mono.
 */
export type Typeface = 'classic' | 'mono';

/** Noto Sans face for a numeric weight, falling back to regular. */
export function sansFor(weight: TextStyle['fontWeight']): string {
  return SansFaces[String(weight)] ?? SansFaces['400'];
}

/** Exo 2 face for a numeric weight, falling back to regular. */
export function displayFor(weight: TextStyle['fontWeight']): string {
  return DisplayFaces[String(weight)] ?? DisplayFaces['400'];
}

/** Geist Mono face for a numeric weight, falling back to regular. */
export function monoFor(weight: TextStyle['fontWeight']): string {
  return MonoFaces[String(weight)] ?? MonoFaces['400'];
}

/** Poppins face for a numeric weight, falling back to regular. */
export function poppinsFor(weight: TextStyle['fontWeight']): string {
  return PoppinsFaces[String(weight)] ?? PoppinsFaces['400'];
}

/**
 * Letter spacing. Exo 2 is wide, so display sizes take noticeable negative
 * tracking to stay optically even; small uppercase labels need positive
 * tracking to stay readable.
 */
export const LetterSpacing = {
  tightest: -1.2,
  tighter: -0.8,
  tight: -0.4,
  snug: -0.2,
  normal: 0,
  wide: 0.4,
  wider: 1,
} as const;
