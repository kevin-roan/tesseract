import { useWindowDimensions } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { createTheme, type Theme } from '@/theme/create-theme';

/**
 * The resolved theme for the current color scheme and window size.
 * Re-renders on scheme change, rotation, split view and web resize.
 *
 *   const { colors, spacing, text } = useAppTheme();
 *
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */
export function useAppTheme(): Theme {
  const scheme = useColorScheme();
  const { width, height } = useWindowDimensions();

  return createTheme({
    scheme: scheme === 'dark' ? 'dark' : 'light',
    width,
    height,
  });
}
