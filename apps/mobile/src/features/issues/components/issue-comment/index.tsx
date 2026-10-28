import { useMemo } from "react";
import { View } from "react-native";
import type { IssueComment as IssueCommentData } from "@tesseract/protocol";

import ClaudeMark from "@/components/claude-mark";
import Markdown from "@/components/markdown";
import PressableScale from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { formatRelativeTime } from "@/features/sandbox/utils/format";
import { IconSize } from "@/theme";

import { ISSUE_AUTHOR_ICONS, ISSUE_AUTHOR_LABELS, ISSUE_DETAIL_COPY } from "../../utils/content";
import createStyles from "./styles";

export type IssueCommentProps = {
  comment: IssueCommentData;
  onOpenRun?: (runId: string) => void;
};

const IssueComment = ({ comment, onOpenRun }: IssueCommentProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const system = comment.author === "system";
  const runId = comment.agentRunId;
  const AuthorIcon = comment.author === "claude" ? null : ISSUE_AUTHOR_ICONS[comment.author];

  return (
    <View style={styles.comment} testID={`issue-comment-${comment.id}`}>
      <View style={styles.avatar}>
        {AuthorIcon ? (
          <AuthorIcon size={system ? IconSize.sm : IconSize.md} color={theme.colors[system ? "textTertiary" : "textSecondary"]} />
        ) : (
          <ClaudeMark size={IconSize.md} />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.meta}>
          <ThemedText variant="label" color={system ? "textSecondary" : "text"} numberOfLines={1} style={styles.author}>
            {ISSUE_AUTHOR_LABELS[comment.author]}
          </ThemedText>
          <ThemedText variant="caption" color="textTertiary">
            {formatRelativeTime(comment.createdAt)}
          </ThemedText>
        </View>
        {system ? (
          <ThemedText variant="bodySmall" color="textSecondary">
            {comment.body}
          </ThemedText>
        ) : (
          <Surface style={styles.card}>
            <Markdown>{comment.body}</Markdown>
          </Surface>
        )}
        {runId && onOpenRun ? (
          <PressableScale
            accessibilityRole="link"
            onPress={() => onOpenRun(runId)}
            testID={`issue-comment-${comment.id}-run`}
          >
            <ThemedText variant="caption" color="accentStrong">
              {ISSUE_DETAIL_COPY.viewRun}
            </ThemedText>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
};

export default IssueComment;
