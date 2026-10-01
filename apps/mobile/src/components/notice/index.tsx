import { useMemo } from "react";
import { Pressable, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors, type Tone } from "@/lib/tone";
import { HitSlop, IconSize } from "@/theme";

import createStyles from "./styles";

export type NoticeProps = {
  message: string;
  title?: string;
  tone?: Tone;
  icon?: Icon;
  actionLabel?: string;
  onAction?: () => void;
};

const Notice = ({ message, title, tone = "neutral", icon: IconComponent, actionLabel, onAction }: NoticeProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);
  const { foreground } = ToneColors[tone];

  return (
    <View style={styles.notice} accessibilityRole="alert">
      {IconComponent ? (
        <View style={styles.iconBadge}>
          <IconComponent size={IconSize.md} color={theme.colors[foreground]} weight="duotone" />
        </View>
      ) : null}
      <View style={styles.body}>
        {title ? (
          <ThemedText variant="h4" color={foreground}>
            {title}
          </ThemedText>
        ) : null}
        <ThemedText variant="bodySmall" color="textSecondary">
          {message}
        </ThemedText>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={HitSlop.md}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <ThemedText variant="label" color="text" numberOfLines={1}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
};

export default Notice;
