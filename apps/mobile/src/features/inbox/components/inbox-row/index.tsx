import { useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeOut, ZoomIn } from "react-native-reanimated";
import type { InboxItem } from "@theone/protocol";

import IconTile from "@/components/icon-tile";
import PressableScale from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { ToneColors } from "@/lib/tone";
import { formatRelativeTime } from "@/features/sandbox/utils/format";
import { ControlHeight, Durations, IconSize, MaxFontSizeMultiplier, StaggerCap } from "@/theme";

import { isUnread, needsAttention } from "../../utils/group";
import { inboxKindMeta } from "../../utils/kinds";
import createStyles from "./styles";

export type InboxRowProps = {
  item: InboxItem;
  project: string | null;
  onPress: () => void;
  onLongPress?: () => void;
  /** Position in the inbox, for the staggered entrance. */
  index?: number;
};

const dotIn = ZoomIn.duration(Durations.normal);
const dotOut = FadeOut.duration(Durations.normal);

const InboxRow = ({ item, project, onPress, onLongPress, index = 0 }: InboxRowProps) => {
  const theme = useAppTheme();
  const meta = inboxKindMeta(item.kind);
  const unread = isUnread(item);
  const emphasized = needsAttention(item);
  const styles = useMemo(() => createStyles(theme, meta.tone, emphasized), [theme, meta.tone, emphasized]);
  const time = formatRelativeTime(item.updatedAt);
  const entering = useEntrance(index, "tight");
  const motion = useLayoutMotion();
  const animated = index < StaggerCap;

  return (
    <Animated.View entering={animated ? entering : undefined} layout={animated ? motion.layout : undefined}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[unread ? "Unread" : null, meta.label, item.title, item.body, project, time].filter(Boolean).join(", ")}
        accessibilityHint={onLongPress && unread ? "Long press to mark as read" : undefined}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <Surface style={styles.card}>
          <IconTile
            icon={meta.icon}
            size={ControlHeight.md}
            iconSize={IconSize.md}
            color={ToneColors[meta.tone].foreground}
            radius="md"
          />
          <View style={styles.body}>
            <View style={styles.top}>
              <ThemedText variant={unread ? "bodyStrong" : "body"} numberOfLines={1} style={styles.title}>
                {item.title}
              </ThemedText>
              {unread ? (
                <Animated.View entering={dotIn} exiting={dotOut} style={styles.unreadDot} testID="inbox-unread-dot" />
              ) : null}
            </View>
            {item.body ? (
              <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={3}>
                {item.body}
              </ThemedText>
            ) : null}
            <View style={styles.meta}>
              <ThemedText
                variant="caption"
                color={ToneColors[meta.tone].foreground}
                numberOfLines={1}
                maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
              >
                {meta.label}
              </ThemedText>
              {project ? (
                <ThemedText
                  variant="caption"
                  color="textTertiary"
                  numberOfLines={1}
                  maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
                  style={styles.project}
                >
                  {project}
                </ThemedText>
              ) : null}
              <ThemedText
                variant="caption"
                color="textTertiary"
                numberOfLines={1}
                maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
                style={styles.time}
              >
                {time}
              </ThemedText>
            </View>
          </View>
        </Surface>
      </PressableScale>
    </Animated.View>
  );
};

export default InboxRow;
