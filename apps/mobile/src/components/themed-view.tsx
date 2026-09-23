import { View, type ViewProps } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import type { ThemeColor } from '@/theme';

export type ThemedViewProps = ViewProps & {
  /** Semantic color key used as the background — see `Colors` in `@/theme`. */
  background?: ThemeColor;
};

export function ThemedView({ style, background = 'background', ...rest }: ThemedViewProps) {
  const theme = useAppTheme();

  return <View style={[{ backgroundColor: theme.colors[background] }, style]} {...rest} />;
}
