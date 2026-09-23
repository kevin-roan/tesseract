import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

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

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={theme.colors.textSecondary} accessibilityLabel={title} />
      ) : IconComponent ? (
        <View style={styles.iconBadge}>
          <IconComponent size={IconSize.xl} color={theme.colors.text} weight="duotone" />
        </View>
      ) : null}
      <View style={styles.copy}>
        <ThemedText variant="h3" style={styles.centered}>
          {title}
        </ThemedText>
        {message ? (
          <ThemedText variant="body" color="textSecondary" style={styles.centered}>
            {message}
          </ThemedText>
        ) : null}
      </View>
      {actionLabel && onAction ? <ActionButton label={actionLabel} onPress={onAction} /> : null}
      {secondaryLabel && onSecondary ? (
        <ActionButton label={secondaryLabel} onPress={onSecondary} variant="secondary" size="sm" />
      ) : null}
    </View>
  );
};

export default EmptyState;
