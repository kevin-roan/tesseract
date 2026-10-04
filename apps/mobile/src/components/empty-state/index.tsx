import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import Animated from "react-native-reanimated";
import type { Icon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import IconTile from "@/components/icon-tile";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { AvatarSize, IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type EmptyStateProps = {
  title: string;
  message?: string;
  icon?: Icon;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

const EmptyState = ({
  title,
  message,
  icon: IconComponent,
  loading = false,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entering = useEntrance();

  return (
    <Animated.View entering={entering} style={styles.container}>
      {loading ? (
        <ActivityIndicator color={theme.colors.textSecondary} accessibilityLabel={title} />
      ) : IconComponent ? (
        <IconTile icon={IconComponent} size={AvatarSize.xl} iconSize={IconSize.xl} radius="card" />
      ) : null}
      <View style={styles.copy}>
        <ThemedText
          variant="h3"
          style={styles.centered}
          accessibilityRole="header"
          maxFontSizeMultiplier={MaxFontSizeMultiplier.heading}
        >
          {title}
        </ThemedText>
        {message ? (
          <ThemedText variant="bodySmall" color="textSecondary" style={styles.centered}>
            {message}
          </ThemedText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <View>
          <ActionButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
      {secondaryLabel && onSecondary ? (
        <View>
          <ActionButton label={secondaryLabel} onPress={onSecondary} variant="secondary" size="sm" />
        </View>
      ) : null}
    </Animated.View>
  );
};

export default EmptyState;
