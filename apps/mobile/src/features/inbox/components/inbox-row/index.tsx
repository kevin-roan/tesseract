import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import type { InboxItem } from "@tesseract/protocol";

import PressableScale from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { formatRelativeTime } from "@/features/sandbox/utils/format";
import { MaxFontSizeMultiplier, StaggerCap } from "@/theme";

import { isUnread, needsAttention } from "../../utils/group";
import { inboxKindMeta } from "../../utils/kinds";
import { plainPreview } from "../../utils/preview";
import createStyles from "./styles";

export type InboxRowProps = {
  item: InboxItem;
  project: string | null;
  onPress: () => void;
  onLongPress?: () => void;
  /** Position in the inbox, for the staggered entrance. */
  index?: number;
};

const InboxRow = ({ item, project, onPress, onLongPress, index = 0 }: InboxRowProps) => {
  const theme = useAppTheme();
  const meta = inboxKindMeta(item.kind);
  const unread = isUnread(item);
  const emphasized = needsAttention(item);
  const styles = useMemo(() => createStyles(theme, emphasized), [theme, emphasized]);
  const time = formatRelativeTime(item.updatedAt);
  const preview = item.body ? plainPreview(item.body) : "";
  const KindIcon = meta.icon;
  const entering = useEntrance(index, "tight");
  const motion = useLayoutMotion();
  const animated = index < StaggerCap;

  return (
    <Animated.View entering={animated ? entering : undefined} layout={animated ? motion.layout : undefined}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[unread ? "Unread" : null, project, meta.label, item.title, item.body, time].filter(Boolean).join(", ")}
        accessibilityHint={onLongPress && unread ? "Long press to mark as read" : undefined}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <Surface style={styles.card}>
          <View style={styles.top}>
            <ThemedText variant="label" color={unread ? "text" : "textSecondary"} numberOfLines={1} style={styles.project}>
              {project ?? meta.label}
            </ThemedText>
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
          <View style={styles.body}>
            <KindIcon size={16} color={theme.colors[unread ? "text" : "textSecondary"]} weight={emphasized ? "fill" : "regular"} style={styles.icon} />
            <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2} style={styles.preview}>
              {preview || item.title}
            </ThemedText>
          </View>
        </Surface>
      </PressableScale>
    </Animated.View>
  );
};

export default InboxRow;
