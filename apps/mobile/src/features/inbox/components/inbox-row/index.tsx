import { useMemo } from "react";
import { Pressable, View } from "react-native";
import type { InboxItem } from "@theone/protocol";

import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors } from "@/lib/tone";
import { formatRelativeTime } from "@/features/sandbox/utils/format";
import { IconSize } from "@/theme";

import { isUnread, needsAttention } from "../../utils/group";
import { inboxKindMeta } from "../../utils/kinds";
import createStyles from "./styles";

export type InboxRowProps = {
  item: InboxItem;
  project: string | null;
  onPress: () => void;
  onLongPress?: () => void;
};

const InboxRow = ({ item, project, onPress, onLongPress }: InboxRowProps) => {
  const theme = useAppTheme();
  const meta = inboxKindMeta(item.kind);
  const unread = isUnread(item);
  const emphasized = needsAttention(item);
  const styles = useMemo(() => createStyles(theme, meta.tone, emphasized), [theme, meta.tone, emphasized]);
  const { icon: KindIcon } = meta;
  const time = formatRelativeTime(item.updatedAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[unread ? "Unread" : null, meta.label, item.title, item.body, project, time].filter(Boolean).join(", ")}
      accessibilityHint={onLongPress && unread ? "Long press to mark as read" : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Surface style={styles.card}>
        <View style={styles.badge}>
          <KindIcon size={IconSize.md} color={theme.colors[ToneColors[meta.tone].foreground]} weight="duotone" />
        </View>
        <View style={styles.body}>
          <View style={styles.top}>
            <ThemedText variant={unread ? "bodyStrong" : "body"} numberOfLines={1} style={styles.title}>
              {item.title}
            </ThemedText>
            {unread ? <View style={styles.unreadDot} testID="inbox-unread-dot" /> : null}
          </View>
          {item.body ? (
            <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={3}>
              {item.body}
            </ThemedText>
          ) : null}
          <View style={styles.meta}>
            <ThemedText variant="caption" color={ToneColors[meta.tone].foreground}>
              {meta.label}
            </ThemedText>
            {project ? (
              <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
                {project}
              </ThemedText>
            ) : null}
            <ThemedText variant="caption" color="textTertiary">
              {time}
            </ThemedText>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
};

export default InboxRow;
