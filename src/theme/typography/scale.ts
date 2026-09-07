import type { TextStyle } from 'react-native';

import { scaleFont } from '../responsive';
import { FontWeights, Fonts, LetterSpacing } from './fonts';

/**
 * Text variants, defined at the phone baseline (390dp wide). `createTextStyles`
 * scales them for the current window; on tablets the growth is intentionally
 * small because the OS font scale already handles accessibility sizing.
 */
export const TextVariants = {
  display: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.tighter,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.tight,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: FontWeights.semibold,
    letterSpacing: LetterSpacing.tight,
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: FontWeights.semibold,
  },
  h4: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: FontWeights.semibold,
  },
  /** Lead paragraph, assistant greeting. */
  bodyLarge: {
    fontSize: 18,
    lineHeight: 28,
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
    fontSize: 16,
    lineHeight: 20,
    fontWeight: FontWeights.semibold,
  },
  /** Timestamps, helper text, token counts. */
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: FontWeights.regular,
  },
  /** Uppercase section headers. */
  overline: {
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
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof TextVariants;

/** Scales every variant's font size and line height for the current window. */
export function createTextStyles(width: number, height: number): Record<TextVariant, TextStyle> {
  const entries = Object.entries(TextVariants).map(([key, variant]) => {
    const { fontSize, lineHeight, ...rest } = variant as TextStyle;
    return [
      key,
      {
        ...rest,
        ...(fontSize !== undefined && { fontSize: scaleFont(fontSize, width, height) }),
        ...(lineHeight !== undefined && { lineHeight: scaleFont(lineHeight, width, height) }),
      },
    ];
  });
  return Object.fromEntries(entries) as Record<TextVariant, TextStyle>;
}
