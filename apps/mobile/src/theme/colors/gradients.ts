import { Palette } from './palette';
import type { ColorSchemeName } from './semantic';

/**
 * Named linear gradients. A gradient is a whole look — colors, stops and
 * direction travel together — so components pick a name instead of assembling
 * ramps inline:
 *
 *   <LinearGradient {...theme.gradients.brand} style={StyleSheet.absoluteFill} />
 *
 * They are for components only; screens sit on the flat `colors.background`.
 */
export type Gradient = {
  colors: readonly [string, string, ...string[]];
  locations: readonly [number, number, ...number[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/** Straight down, for gradients that should read as light falling on a panel. */
const Vertical = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } } as const;
/** Left to right, for pills and buttons. */
const Horizontal = { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } } as const;

const light = {
  /** The primary pill: flat near-black, as in Claude — a gradient in name only so callers stay uniform. */
  brand: {
    colors: [Palette.ink, Palette.ink],
    locations: [0, 1],
    ...Horizontal,
  },
  /** Fades content into the canvas above a sticky footer or input bar. */
  scrim: {
    colors: ['rgba(245, 244, 239, 0)', 'rgba(245, 244, 239, 0.85)', Palette.canvas],
    locations: [0, 0.6, 1],
    ...Vertical,
  },
  /** A barely-there terracotta glow at the top of a hero, fading into the paper. */
  wash: {
    colors: [Palette.clay[50], Palette.canvas, Palette.canvas],
    locations: [0, 0.45, 1],
    ...Vertical,
  },
} as const;

const dark: Record<keyof typeof light, Gradient> = {
  brand: {
    colors: [Palette.paper, Palette.paper],
    locations: [0, 1],
    ...Horizontal,
  },
  scrim: {
    colors: ['rgba(38, 38, 36, 0)', 'rgba(38, 38, 36, 0.85)', Palette.night],
    locations: [0, 0.6, 1],
    ...Vertical,
  },
  wash: {
    colors: [Palette.clay[900], Palette.night, Palette.night],
    locations: [0, 0.45, 1],
    ...Vertical,
  },
};

const graphite: Record<keyof typeof light, Gradient> = {
  brand: {
    colors: [Palette.graphite[100], Palette.graphite[100]],
    locations: [0, 1],
    ...Horizontal,
  },
  scrim: {
    colors: ['rgba(13, 13, 13, 0)', 'rgba(13, 13, 13, 0.85)', Palette.graphite[950]],
    locations: [0, 0.6, 1],
    ...Vertical,
  },
  wash: {
    colors: [Palette.clay[900], Palette.graphite[950], Palette.graphite[950]],
    locations: [0, 0.45, 1],
    ...Vertical,
  },
};

const graphiteLight: Record<keyof typeof light, Gradient> = {
  brand: {
    colors: [Palette.graphite[950], Palette.graphite[950]],
    locations: [0, 1],
    ...Horizontal,
  },
  scrim: {
    colors: ['rgba(245, 245, 245, 0)', 'rgba(245, 245, 245, 0.85)', Palette.graphite[50]],
    locations: [0, 0.6, 1],
    ...Vertical,
  },
  wash: {
    colors: [Palette.clay[50], Palette.graphite[50], Palette.graphite[50]],
    locations: [0, 0.45, 1],
    ...Vertical,
  },
};

export const Gradients = { light, dark, graphite, graphiteLight } as const;

export type GradientName = keyof typeof light;

export function gradientsFor(scheme: ColorSchemeName): Record<GradientName, Gradient> {
  return Gradients[scheme];
}
