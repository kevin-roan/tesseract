import { Platform, type TextStyle } from 'react-native';

import { scaleFont } from '../responsive';
import { FontWeights, Fonts, LetterSpacing, displayFor, sansFor } from './fonts';

/** Which family a variant draws from: Exo 2 (`display`) or Noto Sans (`text`). */
export type TypeFamily = 'display' | 'text';

type VariantStyle = TextStyle & { family?: TypeFamily };

/**
 * Text variants, defined at the phone baseline (390dp wide). `createTextStyles`
 * scales them for the current window; on tablets the growth is intentionally
 * small because the OS font scale already handles accessibility sizing.
 */
export const TextVariants = {
  display: {
    family: 'display',
    fontSize: 48,
    lineHeight: 54,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.tightest,
  },
  /** Screen hero title; pair a lighter and a bolder word via nested `fontFamily`. */
  title: {
    family: 'display',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: FontWeights.medium,
    letterSpacing: LetterSpacing.tighter,
  },
  /** Centered home greeting ("Good evening, …"): large but light, like Claude's. */
  greeting: {
    family: 'display',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: FontWeights.regular,
    letterSpacing: LetterSpacing.tight,
  },
  h1: {
    family: 'display',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.tighter,
  },
  h2: {
    family: 'display',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.tight,
  },
  h3: {
    family: 'display',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.snug,
  },
  h4: {
    family: 'display',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.snug,
  },
  /** Headline numbers in cards. */
  metric: {
    family: 'display',
    fontSize: 44,
    lineHeight: 48,
    fontWeight: FontWeights.bold,
    letterSpacing: LetterSpacing.tightest,
    fontVariant: ['tabular-nums'],
  },
  /** Numbers in stat tiles. */
  metricSmall: {
    family: 'display',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.tighter,
    fontVariant: ['tabular-nums'],
  },
  /** Lead paragraph, assistant greeting. */
  bodyLarge: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: FontWeights.regular,
  },
  /** Default reading size — chat messages, article copy. */
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: FontWeights.regular,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: FontWeights.semibold,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: FontWeights.regular,
  },
  /** Form labels, list subtitles. */
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: FontWeights.medium,
  },
  button: {
    family: 'display',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.normal,
  },
  /** Timestamps, helper text, token counts. */
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: FontWeights.regular,
  },
  /** Uppercase section headers. */
  overline: {
    family: 'display',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  },
  /** Inline and block code in assistant responses. */
  code: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: FontWeights.regular,
  },
} as const satisfies Record<string, VariantStyle>;

export type TextVariant = keyof typeof TextVariants;

/** Android pads the fonts' tall ascent/descent on top of the line height; drop it so text boxes and icon alignment match iOS. */
const AndroidTextMetrics: TextStyle =
  Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' } : {};

/**
 * Scales every variant's font size and line height for the current window, and
 * resolves `fontWeight` to the Exo 2 or Noto Sans face that carries it (per the
 * variant's `family`) — Android will not pick a heavier face out of a custom
 * family on its own. Variants that name
 * their own family (`code`) keep it and keep the plain weight.
 */
export function createTextStyles(width: number, height: number): Record<TextVariant, TextStyle> {
  const entries = Object.entries(TextVariants).map(([key, variant]) => {
    const { family, fontSize, lineHeight, fontWeight, fontFamily, ...rest } = variant as VariantStyle;
    const faceFor = family === 'display' ? displayFor : sansFor;
    return [
      key,
      {
        ...rest,
        ...AndroidTextMetrics,
        ...(fontFamily === undefined
          ? { fontFamily: faceFor(fontWeight) }
          : { fontFamily, fontWeight }),
        ...(fontSize !== undefined && { fontSize: scaleFont(fontSize, width, height) }),
        ...(lineHeight !== undefined && { lineHeight: scaleFont(lineHeight, width, height) }),
      },
    ];
  });
  return Object.fromEntries(entries) as Record<TextVariant, TextStyle>;
}
