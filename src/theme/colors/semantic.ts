import { Palette } from './palette';

/**
 * Semantic colors. Both schemes declare the same keys — that invariant is what
 * `ColorScheme` below enforces, so a color added to light cannot be forgotten
 * in dark.
 */
const light = {
  // Surfaces
  background: Palette.canvas,
  backgroundElement: Palette.gray[100],
  backgroundSelected: Palette.gray[200],
  surface: Palette.canvas,
  surfaceElevated: Palette.white,
  surfaceSunken: Palette.gray[50],
  overlay: 'rgba(0, 0, 0, 0.4)',
  /** Tint laid over the blur when native liquid glass is unavailable. */
  glassFallback: 'rgba(252, 252, 251, 0.42)',

  // Text
  text: Palette.black,
  textSecondary: Palette.gray[600],
  textTertiary: Palette.gray[500],
  textInverse: Palette.canvas,
  // The brand lime is far too bright to carry white text — ink it dark instead.
  textOnAccent: Palette.lime[900],

  // Lines
  border: Palette.gray[200],
  borderStrong: Palette.gray[300],
  divider: Palette.gray[100],

  // Accent
  accent: Palette.lime[500],
  accentPressed: Palette.lime[600],
  accentMuted: Palette.lime[100],
  focusRing: Palette.lime[600],

  // Status
  success: Palette.green[500],
  successMuted: Palette.green[100],
  warning: Palette.amber[500],
  warningMuted: Palette.amber[100],
  danger: Palette.red[500],
  dangerMuted: Palette.red[100],

  // Assistant surfaces
  bubbleUser: Palette.lime[500],
  bubbleUserText: Palette.lime[900],
  bubbleAssistant: Palette.gray[100],
  bubbleAssistantText: Palette.black,
  codeBackground: Palette.gray[50],
  streamingCursor: Palette.lime[600],
  voiceActive: Palette.violet[500],
} as const;

const dark: Record<keyof typeof light, string> = {
  background: Palette.black,
  backgroundElement: Palette.gray[900],
  backgroundSelected: Palette.gray[800],
  surface: Palette.gray[950],
  surfaceElevated: Palette.gray[900],
  surfaceSunken: Palette.black,
  overlay: 'rgba(0, 0, 0, 0.6)',
  glassFallback: 'rgba(24, 24, 26, 0.38)',

  text: Palette.white,
  textSecondary: Palette.gray[400],
  textTertiary: Palette.gray[500],
  textInverse: Palette.black,
  textOnAccent: Palette.lime[900],

  border: Palette.gray[800],
  borderStrong: Palette.gray[700],
  divider: Palette.gray[900],

  accent: Palette.lime[500],
  accentPressed: Palette.lime[300],
  accentMuted: '#1C2E0B',
  focusRing: Palette.lime[400],

  success: Palette.green[500],
  successMuted: '#0F2A1B',
  warning: Palette.amber[500],
  warningMuted: '#2C2109',
  danger: Palette.red[500],
  dangerMuted: '#2E1213',

  bubbleUser: Palette.lime[500],
  bubbleUserText: Palette.lime[900],
  bubbleAssistant: Palette.gray[900],
  bubbleAssistantText: Palette.white,
  codeBackground: Palette.gray[950],
  streamingCursor: Palette.lime[500],
  voiceActive: Palette.violet[500],
};

export const Colors = { light, dark } as const;

export type ColorSchemeName = keyof typeof Colors;
export type ColorScheme = typeof light;
export type ThemeColor = keyof ColorScheme;
