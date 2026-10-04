import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import type { Icon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { ToneColors, type Tone } from "@/lib/tone";

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
  const motion = useLayoutMotion();
  const dot = <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;

  return (
    <Animated.View
      entering={motion.fadeIn}
      layout={motion.layout}
      style={styles.notice}
      accessibilityRole="alert"
    >
      {IconComponent ? <IconTile icon={IconComponent} color={foreground} radius="md" /> : null}
      <View style={styles.body}>
        {title ? (
          <View style={styles.titleRow}>
            {dot}
            <ThemedText variant="label" style={styles.title}>
              {title}
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.messageRow}>
          {title ? null : dot}
          <ThemedText variant="bodySmall" color="textSecondary" style={styles.message}>
            {message}
          </ThemedText>
        </View>
      </View>
      {actionLabel && onAction ? <TagChip label={actionLabel} onPress={onAction} /> : null}
    </Animated.View>
  );
};

export default Notice;
