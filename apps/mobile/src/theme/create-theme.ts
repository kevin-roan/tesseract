import {
  Colors,
  chartFor,
  gradientsFor,
  surfacesFor,
  type ColorScheme,
  type ColorSchemeName,
  type SurfaceTone,
} from './colors';
import { isTablet as isTabletSize, resolveBreakpoint, resolveDeviceClass } from './tokens/breakpoints';
import { GridColumns, MaxBubbleWidthRatio, MaxContentWidth, SidebarWidth } from './tokens/layout';
import { createRadius } from './tokens/radius';
import { ScreenGutter, SectionGap, createSpacing } from './tokens/spacing';
import { createTextStyles } from './typography/scale';

export type ThemeInput = {
  scheme: ColorSchemeName;
  width: number;
  height: number;
  /** Surface the theme is resolved inside; its ink overrides the scheme colors. */
  tone?: SurfaceTone;
};

export type Theme = ReturnType<typeof buildTheme>;

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
    colors: (tone ? { ...Colors[scheme], ...surfaces[tone].ink } : Colors[scheme]) as ColorScheme,
    gradients: gradientsFor(scheme),
    /** Card fills, rendered by `<Surface tone="…" />`. */
    surfaces,
    /** Data-viz colors: `chart.categorical[i]`, `chart.named.teal`, `chart.status.danger`, `chart.bar`. */
    chart: chartFor(scheme),

    spacing: createSpacing(width, height),
    radius: createRadius(width, height),
    text: createTextStyles(width, height),

    /** Viewport facts, for the occasional branch a token cannot express. */
    breakpoint,
    device,
    isTablet: tablet,
    isPhone: !tablet,
    isLandscape: landscape,
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
