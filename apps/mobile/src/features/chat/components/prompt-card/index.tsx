import { memo, useMemo, type ReactNode } from "react";
import { View } from "react-native";

import Avatar from "@/components/avatar";
import Markdown from "@/components/markdown";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AvatarSize } from "@/theme";

import createStyles from "./styles";

export type PromptCardProps = {
  author: string;
  text?: string;
  timeLabel?: string;
  children?: ReactNode;
  testID?: string;
};

/** The prompt that started a turn: a flat card with who sent it, attachments and the text. */
const PromptCard = ({ author, text, timeLabel, children, testID }: PromptCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <Avatar name={author} size={AvatarSize.xs} initialsVariant="overline" />
        <ThemedText variant="label" numberOfLines={1} style={styles.author}>
          {author}
        </ThemedText>
        {timeLabel ? (
          <ThemedText variant="caption" color="textTertiary" style={styles.time}>
            {timeLabel}
          </ThemedText>
        ) : null}
      </View>
      {children}
      {text ? <Markdown color="bubbleUserText">{text}</Markdown> : null}
    </View>
  );
};

export default memo(PromptCard);
