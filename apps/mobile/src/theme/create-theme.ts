import {
  Colors,
  chartFor,
  gradientsFor,
  surfacesFor,
  type ColorScheme,
  type ColorSchemeName,
  type SurfaceTone,
  type SystemScheme,
} from './colors';
import { isTablet as isTabletSize, resolveBreakpoint, resolveDeviceClass } from './tokens/breakpoints';
import { CompactHeight, GridColumns, MaxBubbleWidthRatio, MaxContentWidth, SidebarWidth } from './tokens/layout';
import { createRadius, type CornerShape } from './tokens/radius';
import { ScreenGutter, SectionGap, createSpacing } from './tokens/spacing';
import type { Typeface } from './typography/fonts';
import { LightHeadingWeights, createTextStyles, type VariantWeights } from './typography/scale';

export type ThemeInput = {
  scheme: ColorSchemeName;
  width: number;
  height: number;
  /** Surface the theme is resolved inside; its ink overrides the scheme colors. */
  tone?: SurfaceTone;
};

export type Theme = ReturnType<typeof buildTheme>;

const ShapeFor: Record<ColorSchemeName, CornerShape> = {
  light: 'soft',
  dark: 'soft',
  graphite: 'square',
  graphiteLight: 'square',
};

const KeyboardAppearanceFor: Record<ColorSchemeName, 'default' | 'light' | 'dark'> = {
  light: 'default',
  dark: 'default',
  graphite: 'dark',
  graphiteLight: 'light',
};

/** Whether a scheme is drawn light or dark; native chrome (status bar, keyboards, navigation) follows this. */
const ModeFor: Record<ColorSchemeName, SystemScheme> = {
  light: 'light',
  dark: 'dark',
  graphite: 'dark',
  graphiteLight: 'light',
};

const TypefaceFor: Record<ColorSchemeName, Typeface> = {
  light: 'classic',
  dark: 'classic',
  graphite: 'classic',
  graphiteLight: 'classic',
};

/** Visual language a scheme is drawn in; components branch on this, never on the typeface. */
export type Look = 'classic' | 'graphite';

const LookFor: Record<ColorSchemeName, Look> = {
  light: 'classic',
  dark: 'classic',
  graphite: 'graphite',
  graphiteLight: 'graphite',
};

const WeightsFor: Record<Look, VariantWeights> = {
  classic: {},
  graphite: LightHeadingWeights,
};

/**
 * Builds the resolved theme for one scheme + window size. Everything that
 * depends on the viewport is computed here once, so components read finished
 * numbers instead of calling scaling helpers inline.
 */
function buildTheme({ scheme, width, height, tone }: ThemeInput) {
  const surfaces = surfacesFor(scheme);
  const breakpoint = resolveBreakpoint(width);
  const device = resolveDeviceClass(width, height);
  const tablet = isTabletSize(width, height);
  const landscape = width > height;

  return {
    scheme,
    mode: ModeFor[scheme],
    colors: (tone ? { ...Colors[scheme], ...surfaces[tone].ink } : Colors[scheme]) as ColorScheme,
    gradients: gradientsFor(scheme),
    /** Card fills, rendered by `<Surface tone="…" />`. */
    surfaces,
    /** Data-viz colors: `chart.categorical[i]`, `chart.named.teal`, `chart.status.danger`, `chart.bar`. */
    chart: chartFor(scheme),

    spacing: createSpacing(width, height),
    radius: createRadius(width, height, ShapeFor[scheme]),
    text: createTextStyles(width, height, TypefaceFor[scheme], WeightsFor[LookFor[scheme]]),
    typeface: TypefaceFor[scheme],
    look: LookFor[scheme],
    keyboardAppearance: KeyboardAppearanceFor[scheme],

    /** Viewport facts, for the occasional branch a token cannot express. */
    breakpoint,
    device,
    isTablet: tablet,
    isPhone: !tablet,
    isLandscape: landscape,
    isCompactHeight: height < CompactHeight,
    width,
    height,

    /** Resolved layout values for this viewport. */
    gutter: ScreenGutter[breakpoint],
    sectionGap: SectionGap[breakpoint],
    maxContentWidth: MaxContentWidth[breakpoint],
    maxBubbleWidth: Math.round(width * MaxBubbleWidthRatio[device]),
    gridColumns: GridColumns[breakpoint],
    sidebarWidth: SidebarWidth[device],
    /** True when there is room for a permanent sidebar next to the content. */
    hasSidebar: SidebarWidth[device] !== null && landscape,
  } as const;
}

const cache = new Map<string, Theme>();

/**
 * Resolved theme for a scheme, window size and surface tone, cached by all four so
 * the object identity stays stable across re-renders (which keeps `useMemo`d
 * stylesheets built from it valid).
 */
export function createTheme(input: ThemeInput): Theme {
  const key = `${input.scheme}:${Math.round(input.width)}:${Math.round(input.height)}:${input.tone ?? ''}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const theme = buildTheme(input);

  // Bounded so rotation and split-view resizing cannot grow it without limit.
  if (cache.size > 48) cache.clear();
  cache.set(key, theme);

  return theme;
}
