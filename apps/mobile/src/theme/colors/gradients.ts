import { Palette } from './palette';
import type { ColorSchemeName } from './semantic';

/**
 * Named screen gradients. A gradient is a whole look — colors, stops and
 * direction travel together — so components pick a name instead of assembling
 * ramps inline:
 *
 *   <LinearGradient {...theme.gradients.aurora} style={StyleSheet.absoluteFill} />
 */
export type Gradient = {
  colors: readonly [string, string, ...string[]];
  locations: readonly [number, number, ...number[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/** Top-left to bottom-right, the diagonal every full-screen wash uses. */
const Diagonal = { start: { x: 0.1, y: 0 }, end: { x: 0.9, y: 1 } } as const;
/** Straight down, for gradients that should read as light falling on a panel. */
const Vertical = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } } as const;
/** Left to right, for pills and buttons. */
const Horizontal = { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } } as const;

const light = {
  /** Default screen wash — brand periwinkle breathing out of the top corner. */
  aurora: {
    colors: [Palette.periwinkle[200], Palette.periwinkle[50], Palette.canvas],
    locations: [0, 0.38, 0.82],
    ...Diagonal,
  },
  /** Warm morning light: amber shoulder rolling into periwinkle. */
  dawn: {
    colors: [Palette.amber[100], Palette.periwinkle[100], Palette.canvas],
    locations: [0, 0.42, 0.85],
    ...Diagonal,
  },
  /** Cool counterpart — violet into blue, for focus and voice surfaces. */
  dusk: {
    colors: [Palette.violet[100], Palette.blue[100], Palette.canvas],
    locations: [0, 0.45, 0.9],
    ...Diagonal,
  },
  /** Quiet neutral wash, when content needs the color budget instead. */
  mist: {
    colors: [Palette.gray[100], Palette.gray[25], Palette.canvas],
    locations: [0, 0.5, 1],
    ...Vertical,
  },
  /** Accent-forward fill for primary buttons and user bubbles. */
  brand: {
    colors: [Palette.periwinkle[300], Palette.periwinkle[500], Palette.periwinkle[600]],
    locations: [0, 0.55, 1],
    ...Horizontal,
  },
  /** Fades content into the canvas above a sticky footer or input bar. */
  scrim: {
    colors: ['rgba(252, 252, 251, 0)', 'rgba(252, 252, 251, 0.85)', Palette.canvas],
    locations: [0, 0.6, 1],
    ...Vertical,
  },
} as const;

const dark: Record<keyof typeof light, Gradient> = {
  aurora: {
    colors: ['#2A2350', '#141126', Palette.black],
    locations: [0, 0.42, 0.85],
    ...Diagonal,
  },
  dawn: {
    colors: ['#2C2109', '#1A1530', Palette.black],
    locations: [0, 0.45, 0.88],
    ...Diagonal,
  },
  dusk: {
    colors: ['#241C4A', '#101528', Palette.black],
    locations: [0, 0.48, 0.9],
    ...Diagonal,
  },
  mist: {
    colors: [Palette.gray[900], Palette.gray[950], Palette.black],
    locations: [0, 0.5, 1],
    ...Vertical,
  },
  brand: {
    colors: [Palette.periwinkle[400], Palette.periwinkle[500], Palette.periwinkle[600]],
    locations: [0, 0.55, 1],
    ...Horizontal,
  },
  scrim: {
    colors: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.85)', Palette.black],
    locations: [0, 0.6, 1],
    ...Vertical,
  },
};

export const Gradients = { light, dark } as const;

export type GradientName = keyof typeof light;

export function gradientsFor(scheme: ColorSchemeName): Record<GradientName, Gradient> {
  return Gradients[scheme];
}
