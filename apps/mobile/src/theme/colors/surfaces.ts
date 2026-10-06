import { Palette } from './palette';
import type { ColorSchemeName, SystemScheme, ThemeColor } from './semantic';

/**
 * Surface tones — the card fills screens are built from.
 *
 * Modeled on the Claude app: `neutral` is a plain white card on the ivory
 * paper (warm charcoal in dark mode), and the colored tones are quiet warm
 * tints of it rather than pastels. `ink` is the solid primary: near-black in
 * light, near-white in dark. Each tone is a fill plus the `ink` it needs:
 * color overrides that `<Surface tone="…">` applies to everything inside it,
 * so text, icons and hairlines stay legible without each component knowing
 * which tone it sits on.
 *
 * The legacy names map onto the tints: brand → clay, violet/lavender → lilac,
 * indigo/sky → slate, yellow → wheat, mint → sage, rose → blush, sand → oat.
 */
export type SurfaceTone =
  | 'neutral'
  | 'brand'
  | 'violet'
  | 'indigo'
  | 'yellow'
  | 'lavender'
  | 'mint'
  | 'rose'
  | 'sky'
  | 'sand'
  | 'ink';

export type SurfaceFill = {
  inner: string;
  outer: string;
  cx: number;
  cy: number;
  r: number;
};

/**
 * Frosted panel drawn on top of a surface by `<Glass>`: a translucent fill, a
 * lit rim, a sheen that falls from the top edge, and the scheme the native
 * glass material should render in.
 */
export type SurfaceGlass = {
  fill: string;
  border: string;
  sheen: string;
  scheme: SystemScheme;
};

export type SurfaceStyle = {
  fill: SurfaceFill;
  border: string;
  ink: Partial<Record<ThemeColor, string>>;
  glass: SurfaceGlass;
};

type Tint = { light: string; dark: string };

const flat = (color: string): SurfaceFill => ({ inner: color, outer: color, cx: 0.5, cy: 0, r: 1 });

/** Chips and fields inside a tinted card: a lighter wash of the card. */
const onLightTint = (highlight: string): Partial<Record<ThemeColor, string>> => ({
  surfaceElevated: 'rgba(255, 255, 255, 0.7)',
  backgroundElement: 'rgba(255, 255, 255, 0.6)',
  backgroundSelected: Palette.white,
  highlight,
});

const onDarkTint = (highlight: string): Partial<Record<ThemeColor, string>> => ({
  surfaceElevated: 'rgba(255, 255, 255, 0.06)',
  backgroundElement: 'rgba(255, 255, 255, 0.06)',
  backgroundSelected: 'rgba(255, 255, 255, 0.12)',
  highlight,
});

const lightGlass: SurfaceGlass = {
  fill: 'rgba(255, 255, 255, 0.78)',
  border: 'rgba(31, 30, 29, 0.08)',
  sheen: 'rgba(255, 255, 255, 0.9)',
  scheme: 'light',
};

const darkGlass: SurfaceGlass = {
  fill: 'rgba(58, 57, 54, 0.62)',
  border: 'rgba(255, 255, 255, 0.1)',
  sheen: 'rgba(255, 255, 255, 0.06)',
  scheme: 'dark',
};

const lightTint = (tint: Tint, highlight: string): SurfaceStyle => ({
  fill: flat(tint.light),
  border: 'rgba(31, 30, 29, 0.04)',
  ink: onLightTint(highlight),
  glass: lightGlass,
});

const darkTint = (tint: Tint, highlight: string): SurfaceStyle => ({
  fill: flat(tint.dark),
  border: 'rgba(255, 255, 255, 0.05)',
  ink: onDarkTint(highlight),
  glass: darkGlass,
});

const { tint } = Palette;

const light: Record<SurfaceTone, SurfaceStyle> = {
  neutral: {
    fill: flat(Palette.white),
    border: 'rgba(31, 30, 29, 0.04)',
    ink: {},
    glass: lightGlass,
  },
  brand: lightTint(tint.clay, Palette.clay[600]),
  violet: lightTint(tint.lilac, Palette.clay[500]),
  indigo: lightTint(tint.slate, Palette.blue[550]),
  yellow: lightTint(tint.wheat, Palette.amber[600]),
  lavender: lightTint(tint.lilac, Palette.clay[500]),
  mint: lightTint(tint.sage, Palette.green[500]),
  rose: lightTint(tint.blush, Palette.clay[600]),
  sky: lightTint(tint.slate, Palette.blue[550]),
  sand: lightTint(tint.oat, Palette.clay[500]),
  ink: {
    fill: flat(Palette.ink),
    border: 'rgba(255, 255, 255, 0.06)',
    ink: {
      ...onDarkTint(Palette.clay[400]),
      text: Palette.paper,
      textSecondary: Palette.stone[400],
      textTertiary: Palette.stone[500],
      border: 'rgba(255, 255, 255, 0.1)',
      borderStrong: 'rgba(255, 255, 255, 0.18)',
      divider: 'rgba(255, 255, 255, 0.08)',
      accent: Palette.paper,
      accentInk: Palette.ink,
      textOnAccent: Palette.ink,
    },
    glass: darkGlass,
  },
};

const dark: Record<SurfaceTone, SurfaceStyle> = {
  neutral: {
    fill: flat(Palette.stone[850]),
    border: 'rgba(255, 255, 255, 0.05)',
    ink: {},
    glass: darkGlass,
  },
  brand: darkTint(tint.clay, Palette.clay[400]),
  violet: darkTint(tint.lilac, Palette.clay[400]),
  indigo: darkTint(tint.slate, Palette.blue[450]),
  yellow: darkTint(tint.wheat, Palette.amber[500]),
  lavender: darkTint(tint.lilac, Palette.clay[400]),
  mint: darkTint(tint.sage, Palette.green[400]),
  rose: darkTint(tint.blush, Palette.clay[400]),
  sky: darkTint(tint.slate, Palette.blue[450]),
  sand: darkTint(tint.oat, Palette.clay[400]),
  ink: {
    fill: flat(Palette.paper),
    border: 'rgba(31, 30, 29, 0.06)',
    ink: {
      ...onLightTint(Palette.clay[600]),
      text: Palette.ink,
      textSecondary: Palette.stone[600],
      textTertiary: Palette.stone[650],
      border: 'rgba(31, 30, 29, 0.08)',
      borderStrong: 'rgba(31, 30, 29, 0.16)',
      divider: 'rgba(31, 30, 29, 0.07)',
      backgroundElement: 'rgba(31, 30, 29, 0.06)',
      backgroundSelected: 'rgba(31, 30, 29, 0.12)',
      surfaceElevated: 'rgba(31, 30, 29, 0.04)',
      accent: Palette.ink,
      accentInk: Palette.paper,
      textOnAccent: Palette.paper,
    },
    glass: {
      fill: 'rgba(31, 30, 29, 0.05)',
      border: 'rgba(31, 30, 29, 0.08)',
      sheen: 'rgba(255, 255, 255, 0.6)',
      scheme: 'light',
    },
  },
};

const graphiteGlass: SurfaceGlass = {
  fill: 'rgba(22, 22, 22, 0.72)',
  border: 'rgba(255, 255, 255, 0.07)',
  sheen: 'rgba(255, 255, 255, 0.04)',
  scheme: 'dark',
};

const graphiteTone = (highlight: string): SurfaceStyle => ({
  fill: flat(Palette.graphite[900]),
  border: 'rgba(255, 255, 255, 0.07)',
  ink: onDarkTint(highlight),
  glass: graphiteGlass,
});

const graphite: Record<SurfaceTone, SurfaceStyle> = {
  neutral: {
    fill: { inner: Palette.graphite[850], outer: Palette.graphite[900], cx: 0.2, cy: 0, r: 1.2 },
    border: 'rgba(255, 255, 255, 0.07)',
    ink: {},
    glass: graphiteGlass,
  },
  brand: {
    fill: flat(Palette.linear[500]),
    border: 'rgba(255, 255, 255, 0.1)',
    ink: {
      ...onDarkTint(Palette.graphite[50]),
      textSecondary: 'rgba(250, 249, 245, 0.62)',
      textTertiary: 'rgba(250, 249, 245, 0.5)',
    },
    glass: graphiteGlass,
  },
  violet: graphiteTone(Palette.graphite[100]),
  indigo: graphiteTone(Palette.graphite[100]),
  yellow: graphiteTone(Palette.amber[300]),
  lavender: graphiteTone(Palette.graphite[100]),
  mint: graphiteTone(Palette.green[400]),
  rose: graphiteTone(Palette.red[400]),
  sky: graphiteTone(Palette.graphite[100]),
  sand: graphiteTone(Palette.graphite[100]),
  ink: {
    fill: flat(Palette.graphite[850]),
    border: 'rgba(255, 255, 255, 0.18)',
    ink: onDarkTint(Palette.graphite[100]),
    glass: graphiteGlass,
  },
};

const graphiteLightGlass: SurfaceGlass = {
  fill: 'rgba(255, 255, 255, 0.8)',
  border: 'rgba(0, 0, 0, 0.08)',
  sheen: 'rgba(255, 255, 255, 0.9)',
  scheme: 'light',
};

const onGraphiteLight = (highlight: string): Partial<Record<ThemeColor, string>> => ({
  surfaceElevated: 'rgba(0, 0, 0, 0.03)',
  backgroundElement: 'rgba(0, 0, 0, 0.04)',
  backgroundSelected: 'rgba(0, 0, 0, 0.08)',
  highlight,
});

const graphiteLightTone = (highlight: string): SurfaceStyle => ({
  fill: flat(Palette.white),
  border: 'rgba(0, 0, 0, 0.08)',
  ink: onGraphiteLight(highlight),
  glass: graphiteLightGlass,
});

const graphiteLight: Record<SurfaceTone, SurfaceStyle> = {
  neutral: {
    fill: { inner: Palette.white, outer: '#FAFAFA', cx: 0.2, cy: 0, r: 1.2 },
    border: 'rgba(0, 0, 0, 0.08)',
    ink: {},
    glass: graphiteLightGlass,
  },
  brand: {
    fill: flat(Palette.linear[500]),
    border: 'rgba(0, 0, 0, 0.06)',
    ink: {
      ...onDarkTint(Palette.paper),
      text: Palette.paper,
      textSecondary: 'rgba(250, 249, 245, 0.78)',
      textTertiary: 'rgba(250, 249, 245, 0.64)',
      border: 'rgba(255, 255, 255, 0.18)',
      borderStrong: 'rgba(255, 255, 255, 0.26)',
      divider: 'rgba(255, 255, 255, 0.14)',
      accent: Palette.paper,
      accentInk: Palette.ink,
      textOnAccent: Palette.ink,
    },
    glass: darkGlass,
  },
  violet: graphiteLightTone(Palette.graphite[950]),
  indigo: graphiteLightTone(Palette.graphite[950]),
  yellow: graphiteLightTone(Palette.amber[600]),
  lavender: graphiteLightTone(Palette.graphite[950]),
  mint: graphiteLightTone(Palette.green[500]),
  rose: graphiteLightTone(Palette.red[500]),
  sky: graphiteLightTone(Palette.graphite[950]),
  sand: graphiteLightTone(Palette.graphite[950]),
  ink: {
    fill: flat(Palette.graphite[100]),
    border: 'rgba(0, 0, 0, 0.16)',
    ink: onGraphiteLight(Palette.graphite[950]),
    glass: graphiteLightGlass,
  },
};

export const Surfaces = { light, dark, graphite, graphiteLight } as const;

export function surfacesFor(scheme: ColorSchemeName): Record<SurfaceTone, SurfaceStyle> {
  return Surfaces[scheme];
}
