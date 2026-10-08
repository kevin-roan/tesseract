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
import { ToneColors } from "@/lib/tone";
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
  const styles = useMemo(() => createStyles(theme, meta.tone, emphasized), [theme, meta.tone, emphasized]);
  const time = formatRelativeTime(item.updatedAt);
  const preview = item.body ? plainPreview(item.body) : "";
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
          <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2}>
            <ThemedText variant="bodySmall" color={ToneColors[meta.tone].foreground} style={styles.title}>
              {item.title}
            </ThemedText>
            {preview && preview !== item.title ? ` · ${preview}` : null}
          </ThemedText>
        </Surface>
      </PressableScale>
    </Animated.View>
  );
};

export default InboxRow;
