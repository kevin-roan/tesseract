import { useMemo } from 'react';
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router/react-navigation';

import { useAppTheme } from '@/hooks/use-app-theme';

/** React Navigation theme built from the resolved app theme, so native chrome matches the scheme. */
export function useNavigationTheme(): NavigationTheme {
  const theme = useAppTheme();

  return useMemo(() => {
    const base = theme.mode === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.accent,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.notification,
      },
    };
  }, [theme]);
}
