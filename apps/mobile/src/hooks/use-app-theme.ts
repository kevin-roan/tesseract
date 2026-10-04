import { useWindowDimensions } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSchemeOverride } from '@/hooks/use-scheme-override';
import { useSurfaceTone } from '@/hooks/use-surface-tone';
import type { SurfaceTone } from '@/theme/colors';
import { createTheme, type Theme } from '@/theme/create-theme';

/**
 * The resolved theme for the current color scheme and window size.
 * Re-renders on scheme change, rotation, split view and web resize. Inside a
 * `<SchemeScope scheme="…">` that scheme wins over the system one. Inside a
 * `<Surface tone="…">` the colors carry that tone's ink; pass `tone` to resolve
 * the ink for a surface the caller is about to render.
 *
 *   const { colors, spacing, text } = useAppTheme();
 *
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */
export function useAppTheme(tone?: SurfaceTone): Theme {
  const scheme = useColorScheme();
  const override = useSchemeOverride();
  const { width, height } = useWindowDimensions();
  const surfaceTone = useSurfaceTone();

  return createTheme({
    scheme: override ?? (scheme === 'dark' ? 'dark' : 'light'),
    width,
    height,
    tone: tone ?? surfaceTone,
  });
}
