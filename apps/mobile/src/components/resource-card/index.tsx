import { useMemo, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import type { Icon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import { Surface } from "@/components/surface";
import StatusBadge, { type StatusBadgeProps } from "@/components/status-badge";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePressScale } from "@/hooks/use-press-scale";

import createStyles, { iconTileSize } from "./styles";

export type ResourceCardProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: Icon;
  badge?: StatusBadgeProps;
  monospaceSubtitle?: boolean;
  onPress?: () => void;
  footer?: ReactNode;
  accessory?: ReactNode;
  children?: ReactNode;
  /** Rendered below the footer, e.g. an expanded log view. */
  expanded?: ReactNode;
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
  accessory,
  children,
  expanded,
}: ResourceCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = usePressScale();

  const summary = (
    <>
      <View style={styles.header}>
        {IconComponent ? (
          <IconTile icon={IconComponent} size={iconTileSize(theme)} radius="md" />
        ) : null}
        <View style={styles.body}>
          <ThemedText variant="h4" numberOfLines={1}>
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
        {accessory}
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
    <Animated.View style={press.style}>
      <Surface style={styles.card}>
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={[title, subtitle, badge?.label].filter(Boolean).join(", ")}
            onPress={onPress}
            {...press.handlers}
            style={styles.summary}
          >
            {summary}
          </Pressable>
        ) : (
          <View style={styles.summary}>{summary}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
        {expanded}
      </Surface>
    </Animated.View>
  );
};

export default ResourceCard;
