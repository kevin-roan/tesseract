import { Palette } from './palette';
import { Colors, type ColorSchemeName } from './semantic';

/**
 * Data-visualisation colors.
 *
 *   categorical  Six series hues, assigned in this fixed order and never
 *                cycled — a seventh series folds into "Other". The order is
 *                the colorblind-safety mechanism: every adjacent pair clears
 *                ΔE ≥ 7.5 under protan/deutan/tritan simulation and every
 *                slot is ≥ 3:1 against the screen background, in both schemes
 *                (validated against #F5F4EF light and #262624 dark). Dark
 *                mode is its own set of steps, not an automatic flip.
 *   named        The same hues by name, for when a series owns a color
 *                (keep the color on the entity, not on its rank).
 *   sequential   One hue, light → dark, for magnitude (heatmaps, intensity).
 *   diverging    Two poles around a gray midpoint, for above/below a baseline.
 *   status       Reserved for good / warning / critical states — never reuse
 *                these for "series 4", and always pair them with a label.
 *   grid, axis, label  Recessive chrome, drawn in neutrals so marks lead.
 *   bar, barEmpty, barEmptyStroke  The single-series bar chart: terracotta
 *                pills, with empty slots drawn as a faint fill and dashed rim.
 */
export type ChartPalette = {
  categorical: readonly [string, string, string, string, string, string];
  named: {
    indigo: string;
    teal: string;
    coral: string;
    blue: string;
    rose: string;
    amber: string;
  };
  sequential: readonly [string, string, string, string, string];
  diverging: { negative: string; neutral: string; positive: string };
  status: { success: string; warning: string; danger: string; info: string };
  grid: string;
  axis: string;
  label: string;
  bar: string;
  barEmpty: string;
  barEmptyStroke: string;
};

const lightNamed = {
  indigo: Palette.indigo[500],
  teal: Palette.teal[500],
  coral: Palette.coral[500],
  blue: Palette.blue[500],
  rose: Palette.rose[500],
  amber: Palette.amber[600],
} as const;

const darkNamed = {
  indigo: Palette.indigo[400],
  teal: Palette.teal[400],
  coral: Palette.coral[400],
  blue: Palette.blue[400],
  rose: Palette.rose[400],
  amber: Palette.amber[600],
} as const;

const categoricalOf = (named: ChartPalette['named']): ChartPalette['categorical'] => [
  named.indigo,
  named.teal,
  named.coral,
  named.blue,
  named.rose,
  named.amber,
];

const light: ChartPalette = {
  categorical: categoricalOf(lightNamed),
  named: lightNamed,
  sequential: [Palette.clay[100], Palette.clay[200], Palette.clay[300], Palette.clay[500], Palette.clay[700]],
  diverging: { negative: Palette.coral[500], neutral: Palette.stone[200], positive: Palette.teal[500] },
  status: {
    success: Colors.light.successSolid,
    warning: Colors.light.warningSolid,
    danger: Colors.light.dangerSolid,
    info: Colors.light.infoSolid,
  },
  grid: 'rgba(31, 30, 29, 0.08)',
  axis: Palette.stone[300],
  label: Colors.light.textSecondary,
  bar: Palette.clay[500],
  barEmpty: 'rgba(31, 30, 29, 0.04)',
  barEmptyStroke: 'rgba(31, 30, 29, 0.16)',
};

const dark: ChartPalette = {
  categorical: categoricalOf(darkNamed),
  named: darkNamed,
  sequential: [Palette.clay[900], Palette.clay[800], Palette.clay[600], Palette.clay[400], Palette.clay[200]],
  diverging: { negative: Palette.coral[400], neutral: Palette.stone[700], positive: Palette.teal[400] },
  status: {
    success: Colors.dark.successSolid,
    warning: Colors.dark.warningSolid,
    danger: Colors.dark.dangerSolid,
    info: Colors.dark.infoSolid,
  },
  grid: 'rgba(255, 255, 255, 0.08)',
  axis: Palette.stone[700],
  label: Colors.dark.textSecondary,
  bar: Palette.clay[500],
  barEmpty: 'rgba(255, 255, 255, 0.05)',
  barEmptyStroke: 'rgba(255, 255, 255, 0.18)',
};

export const ChartColors = { light, dark } as const;

export type ChartSeriesName = keyof ChartPalette['named'];

export function chartFor(scheme: ColorSchemeName): ChartPalette {
  return ChartColors[scheme];
}
