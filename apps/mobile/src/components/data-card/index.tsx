import { useMemo, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import type { Icon } from "phosphor-react-native";

import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type DataCardProps = {
  title: string;
  icon?: Icon;
  aside?: ReactNode;
  axis?: readonly string[];
  footer?: ReactNode;
  children?: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const DataCard = ({ title, icon: IconComponent, aside, axis, footer, children, index, style, testID }: DataCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const animated = index !== undefined;
  const entering = useEntrance(index, "loose");

  const card = (
    <Surface style={[styles.card, style]} testID={animated ? undefined : testID}>
      <View style={styles.header}>
        <View style={styles.title}>
          {IconComponent ? <IconComponent size={IconSize.sm} color={theme.colors.textSecondary} weight="light" /> : null}
          <ThemedText
            variant="label"
            accessibilityRole="header"
            numberOfLines={1}
            maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
            style={styles.titleText}
          >
            {title}
          </ThemedText>
        </View>
        {aside}
      </View>
      {children}
      {axis?.length ? (
        <View style={styles.axis}>
          {axis.map((tick, position) => (
            <ThemedText key={position} variant="caption" color="textTertiary" maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
              {tick}
            </ThemedText>
          ))}
        </View>
      ) : null}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Surface>
  );

  if (!animated) return card;

  return (
    <Animated.View entering={entering} testID={testID}>
      {card}
    </Animated.View>
  );
};

export default DataCard;
