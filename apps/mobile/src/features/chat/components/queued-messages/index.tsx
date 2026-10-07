import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ClockIcon, XIcon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { HitSlop, IconSize } from "@/theme";

import type { QueuedMessage } from "../../store/queue-store";
import createStyles from "./styles";

export type QueuedMessagesProps = {
  messages: readonly QueuedMessage[];
  onRemove: (id: string) => void;
};

/** Messages stacked while Claude works; they go out together as soon as the run ends. */
const QueuedMessages = ({ messages, onRemove }: QueuedMessagesProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const motion = useLayoutMotion();

  if (messages.length === 0) return null;

  return (
    <Animated.View entering={motion.fadeIn} exiting={motion.fadeOut} layout={motion.layout} style={styles.card} testID="queued-messages">
      <View style={styles.heading}>
        <ClockIcon size={IconSize.xs} color={theme.colors.textTertiary} />
        <ThemedText variant="caption" color="textTertiary">
          {messages.length === 1 ? "Queued, sends when Claude finishes" : `${messages.length} queued, sent together when Claude finishes`}
        </ThemedText>
      </View>
      {messages.map((message) => (
        <Animated.View key={message.id} entering={motion.fadeIn} exiting={motion.fadeOut} layout={motion.layout} style={styles.row}>
          <ThemedText variant="bodySmall" numberOfLines={2} style={styles.text}>
            {message.prompt}
          </ThemedText>
          <PressableScale
            depth="control"
            accessibilityRole="button"
            accessibilityLabel="Remove queued message"
            hitSlop={HitSlop.sm}
            onPress={() => onRemove(message.id)}
            style={styles.remove}
          >
            <XIcon size={IconSize.xs} color={theme.colors.textSecondary} />
          </PressableScale>
        </Animated.View>
      ))}
    </Animated.View>
  );
};

export default QueuedMessages;
