import { memo, useMemo, type ReactNode } from "react";
import { View } from "react-native";

import Markdown from "@/components/markdown";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import AssistantAvatar from "../assistant-avatar";
import createStyles from "./styles";

export type MessageRole = "user" | "assistant";

export type MessageBubbleProps = {
  role: MessageRole;
  text?: string;
  author?: string;
  timeLabel?: string;
  showHeader?: boolean;
  children?: ReactNode;
  testID?: string;
};

const MessageBubble = ({ role, text, author, timeLabel, showHeader = true, children, testID }: MessageBubbleProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (role === "user") {
    return (
      <View style={styles.user} testID={testID}>
        {children}
        {text ? (
          <View style={styles.userBubble}>
            <ThemedText variant="body" color="bubbleUserText" selectable>
              {text}
            </ThemedText>
          </View>
        ) : null}
        {timeLabel ? (
          <ThemedText variant="caption" color="textTertiary" style={styles.userTime}>
            {timeLabel}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.assistant} testID={testID}>
      {showHeader && (author || timeLabel) ? (
        <View style={styles.header}>
          <AssistantAvatar />
          <View style={styles.meta}>
            {author ? (
              <ThemedText variant="label" numberOfLines={1}>
                {author}
              </ThemedText>
            ) : null}
            {timeLabel ? (
              <ThemedText variant="caption" color="textTertiary" style={styles.time}>
                {timeLabel}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : null}
      {text ? <Markdown color="bubbleAssistantText">{text}</Markdown> : null}
      {children}
    </View>
  );
};

export default memo(MessageBubble);
