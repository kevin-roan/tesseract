import { useMemo, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import { Surface } from "@/components/surface";
import StatusBadge, { type StatusBadgeProps } from "@/components/status-badge";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type ResourceCardProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: Icon;
  badge?: StatusBadgeProps;
  monospaceSubtitle?: boolean;
  onPress?: () => void;
  footer?: ReactNode;
  children?: ReactNode;
};

const ResourceCard = ({
  title,
  subtitle,
  meta,
  icon: IconComponent,
  badge,
  monospaceSubtitle = false,
  onPress,
  footer,
  children,
}: ResourceCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const summary = (
    <>
      <View style={styles.header}>
        {IconComponent ? (
          <View style={styles.iconBadge}>
            <IconComponent size={IconSize.md} color={theme.colors.text} weight="duotone" />
          </View>
        ) : null}
        <View style={styles.body}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText
              variant={monospaceSubtitle ? "code" : "caption"}
              color="textSecondary"
              numberOfLines={2}
            >
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {badge ? <StatusBadge {...badge} /> : null}
      </View>
      {meta ? (
        <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
          {meta}
        </ThemedText>
      ) : null}
      {children}
    </>
  );

  return (
    <Surface style={styles.card}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[title, subtitle, badge?.label].filter(Boolean).join(", ")}
          onPress={onPress}
          style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
        >
          {summary}
        </Pressable>
      ) : (
        <View style={styles.summary}>{summary}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Surface>
  );
};

export default ResourceCard;
