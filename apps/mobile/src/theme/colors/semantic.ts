import { Palette } from './palette';

/**
 * Semantic colors. Both schemes declare the same keys — that invariant is what
 * `ColorScheme` below enforces, so a color added to light cannot be forgotten
 * in dark.
 *
 * Status families (success / warning / danger / info) come in three roles:
 *   `<status>`       text and icon ink — clears WCAG AA (4.5:1) on both the
 *                    screen background and its own `<status>Muted` fill
 *   `<status>Muted`  tinted fill behind that ink (badges, notices)
 *   `<status>Solid`  vivid mark for dots, bars and chart status — ≥ 3:1 on the
 *                    background, never used for body text
 */
const light = {
  // Surfaces
  background: Palette.canvas,
  /** Canvas texture. Claude's paper is flat, so this is fully transparent. */
  backgroundPattern: 'rgba(31, 30, 29, 0)',
  backgroundElement: Palette.stone[100],
  backgroundSelected: Palette.stone[200],
  surface: Palette.white,
  surfaceElevated: Palette.white,
  surfaceSunken: Palette.stone[100],
  overlay: 'rgba(20, 20, 19, 0.32)',
  /** Band of light that sweeps across loading placeholders. Hex only: react-native-fast-shimmer cannot parse rgba(). */
  shimmer: '#FFFFFFD9',

  // Text
  text: Palette.ink,
  textSecondary: Palette.stone[600],
  textTertiary: Palette.stone[650],
  textInverse: Palette.paper,
  textOnAccent: Palette.white,

  // Lines
  border: 'rgba(31, 30, 29, 0.08)',
  borderStrong: 'rgba(31, 30, 29, 0.16)',
  /** Inset hairline between rows of a grouped list. */
  divider: 'rgba(31, 30, 29, 0.07)',

  // Accent
  /** Solid near-black pill: primary buttons, active segments. */
  accent: Palette.ink,
  /** Ink on `accent`. */
  accentInk: Palette.white,
  accentPressed: Palette.stone[700],
  accentMuted: Palette.stone[100],
  /** Accent that reads as ink: links and selected outlines (≥ 4.5:1). */
  accentStrong: Palette.clay[700],
  focusRing: Palette.clay[500],
  /** Progress marks and rings. */
  highlight: Palette.clay[500],

  // Brand
  /** Claude terracotta — the starburst mark; use sparingly, never for body text. */
  brand: Palette.clay[500],
  brandMuted: Palette.clay[50],
  /** Check marks and the selected row in pickers. */
  selection: Palette.blue[550],
  /** Small pills such as "Pro". */
  badge: Palette.blue[150],
  badgeText: Palette.blue[650],

  // Status
  success: Palette.green[700],
  successMuted: Palette.green[100],
  successSolid: '#23874F',
  warning: Palette.amber[800],
  warningMuted: Palette.amber[100],
  warningSolid: Palette.amber[700],
  danger: Palette.red[600],
  dangerMuted: Palette.red[100],
  dangerSolid: Palette.red[500],
  info: Palette.blue[700],
  infoMuted: Palette.blue[100],
  infoSolid: Palette.blue[600],

  /** Unread / count badges. */
  notification: Palette.red[600],
  textOnNotification: Palette.white,

  // Assistant surfaces
  bubbleUser: Palette.stone[100],
  bubbleUserText: Palette.ink,
  /** Assistant replies sit straight on the paper, like Claude's. */
  bubbleAssistant: Palette.canvas,
  bubbleAssistantText: Palette.ink,
  codeBackground: Palette.stone[100],
  streamingCursor: Palette.clay[500],
  voiceActive: Palette.clay[500],
  auraWarm: Palette.clay[300],
  auraCool: Palette.clay[100],
} as const;

const dark: Record<keyof typeof light, string> = {
  background: Palette.night,
  backgroundPattern: 'rgba(250, 249, 245, 0)',
  backgroundElement: Palette.stone[800],
  backgroundSelected: Palette.stone[700],
  surface: Palette.stone[850],
  surfaceElevated: Palette.stone[800],
  surfaceSunken: Palette.stone[900],
  overlay: 'rgba(0, 0, 0, 0.55)',
  shimmer: '#FFFFFF1A',

  text: Palette.paper,
  textSecondary: Palette.stone[400],
  textTertiary: Palette.stone[500],
  textInverse: Palette.ink,
  textOnAccent: Palette.ink,

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  divider: 'rgba(255, 255, 255, 0.08)',

  accent: Palette.paper,
  accentInk: Palette.ink,
  accentPressed: Palette.stone[300],
  accentMuted: Palette.stone[800],
  accentStrong: Palette.clay[400],
  focusRing: Palette.clay[400],
  highlight: Palette.clay[500],

  brand: Palette.clay[500],
  brandMuted: Palette.clay[800],
  selection: Palette.blue[450],
  badge: Palette.blue[850],
  badgeText: Palette.blue[250],

  success: Palette.green[400],
  successMuted: Palette.green[900],
  successSolid: Palette.green[500],
  warning: Palette.amber[300],
  warningMuted: Palette.amber[900],
  warningSolid: Palette.amber[500],
  danger: Palette.red[400],
  dangerMuted: Palette.red[900],
  dangerSolid: Palette.red[500],
  info: Palette.blue[300],
  infoMuted: Palette.blue[900],
  infoSolid: Palette.blue[400],

  notification: Palette.red[400],
  textOnNotification: Palette.black,

  bubbleUser: Palette.stone[900],
  bubbleUserText: Palette.paper,
  bubbleAssistant: Palette.night,
  bubbleAssistantText: Palette.paper,
  codeBackground: Palette.stone[900],
  streamingCursor: Palette.clay[400],
  voiceActive: Palette.clay[500],
  auraWarm: Palette.clay[500],
  auraCool: Palette.clay[800],
};

/**
 * Graphite: a near-black, monochrome terminal look — true greys, hairline
 * cards, white primary pill, green/red reserved for deltas and status.
 */
const graphite: Record<keyof typeof light, string> = {
  ...dark,
  background: Palette.graphite[950],
  /** The faint dot grid drawn behind every graphite screen. */
  backgroundPattern: 'rgba(237, 237, 237, 0.07)',
  backgroundElement: Palette.graphite[850],
  backgroundSelected: Palette.graphite[750],
  surface: Palette.graphite[900],
  surfaceElevated: Palette.graphite[850],
  surfaceSunken: Palette.graphite[950],
  overlay: 'rgba(0, 0, 0, 0.7)',
  shimmer: '#FFFFFF14',

  text: Palette.graphite[100],
  textSecondary: Palette.graphite[400],
  textTertiary: Palette.graphite[500],
  textInverse: Palette.graphite[950],
  textOnAccent: Palette.graphite[950],

  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  divider: 'rgba(255, 255, 255, 0.06)',

  accent: Palette.graphite[100],
  accentInk: Palette.graphite[950],
  accentPressed: Palette.graphite[300],
  accentMuted: Palette.graphite[850],
  accentStrong: Palette.graphite[50],
  focusRing: Palette.graphite[300],
  highlight: Palette.graphite[100],

  /** Warm copper — the one accent hue, for the highlighted card or the active mode; never body text. */
  brand: Palette.clay[400],
  brandMuted: Palette.clay[900],
  selection: Palette.graphite[100],
  badge: Palette.graphite[800],
  badgeText: Palette.graphite[200],

  bubbleUser: Palette.graphite[850],
  bubbleUserText: Palette.graphite[100],
  bubbleAssistant: Palette.graphite[950],
  bubbleAssistantText: Palette.graphite[100],
  codeBackground: Palette.graphite[900],
  streamingCursor: Palette.graphite[100],
  voiceActive: Palette.graphite[100],
  auraWarm: Palette.graphite[300],
  auraCool: Palette.graphite[800],
};

/**
 * Graphite light: the same monochrome look on a pale grey canvas — white
 * hairline cards, near-black primary pill, status inks from `light`.
 */
const graphiteLight: Record<keyof typeof light, string> = {
  ...light,
  background: Palette.graphite[50],
  backgroundPattern: 'rgba(13, 13, 13, 0.08)',
  backgroundElement: Palette.graphite[100],
  backgroundSelected: Palette.graphite[150],
  surface: Palette.white,
  surfaceElevated: Palette.white,
  surfaceSunken: Palette.graphite[100],
  overlay: 'rgba(0, 0, 0, 0.32)',

  text: Palette.graphite[950],
  textSecondary: Palette.graphite[600],
  textTertiary: Palette.graphite[500],
  textInverse: Palette.graphite[50],
  textOnAccent: Palette.graphite[50],

  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.16)',
  divider: 'rgba(0, 0, 0, 0.07)',

  accent: Palette.graphite[950],
  accentInk: Palette.graphite[50],
  accentPressed: Palette.graphite[700],
  accentMuted: Palette.graphite[100],
  accentStrong: Palette.graphite[950],
  focusRing: Palette.graphite[600],
  highlight: Palette.graphite[950],

  brand: Palette.clay[600],
  brandMuted: Palette.clay[50],
  selection: Palette.graphite[950],
  badge: Palette.graphite[100],
  badgeText: Palette.graphite[700],

  bubbleUser: Palette.graphite[100],
  bubbleUserText: Palette.graphite[950],
  bubbleAssistant: Palette.graphite[50],
  bubbleAssistantText: Palette.graphite[950],
  codeBackground: Palette.graphite[100],
  streamingCursor: Palette.graphite[950],
  voiceActive: Palette.graphite[950],
  auraWarm: Palette.graphite[400],
  auraCool: Palette.graphite[150],
};

export const Colors = { light, dark, graphite, graphiteLight } as const;

export type ColorSchemeName = keyof typeof Colors;
/** The schemes the OS knows about — what native materials (blur, glass) accept. */
export type SystemScheme = 'light' | 'dark';
export type ColorScheme = typeof light;
export type ThemeColor = keyof ColorScheme;
