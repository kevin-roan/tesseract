import { Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import type { TextVariant, ThemeColor } from '@/theme';

export type ThemedTextProps = TextProps & {
  /** Type scale variant — see `TextVariants` in `@/theme`. */
  variant?: TextVariant;
  /** Semantic color key — see `Colors` in `@/theme`. */
  color?: ThemeColor;
};

export function ThemedText({ style, variant = 'body', color = 'text', ...rest }: ThemedTextProps) {
  const theme = useAppTheme();

  return <Text style={[theme.text[variant], { color: theme.colors[color] }, style]} {...rest} />;
}
