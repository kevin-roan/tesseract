import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import type { Issue } from "@tesseract/protocol";

import PressableScale from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { MaxFontSizeMultiplier, StaggerCap } from "@/theme";

import { ISSUE_ASSIGNEE_LABELS, ISSUE_PRIORITY_LABELS, ISSUE_STATUS_LABELS, ISSUES_COPY } from "../../utils/content";
import { assigneeChoice, isClosedStatus, isIssueRunning, issueIdentifier } from "../../utils/issues";
import IssueAssigneeMark from "../issue-assignee-mark";
import IssuePriorityIcon from "../issue-priority-icon";
import IssueStatusIcon from "../issue-status-icon";
import RunningDot from "../running-dot";
import createStyles from "./styles";

export type IssueRowProps = {
  issue: Issue;
  onPress: () => void;
  onLongPress?: () => void;
  index?: number;
};

const IssueRow = ({ issue, onPress, onLongPress, index = 0 }: IssueRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entering = useEntrance(index, "tight");
  const motion = useLayoutMotion();
  const animated = index < StaggerCap;
  const identifier = issueIdentifier(issue);
  const running = isIssueRunning(issue);
  const closed = isClosedStatus(issue.status);

  return (
    <Animated.View entering={animated ? entering : undefined} layout={animated ? motion.layout : undefined}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[
          identifier,
          issue.title,
          ISSUE_STATUS_LABELS[issue.status],
          ISSUE_PRIORITY_LABELS[issue.priority],
          ISSUE_ASSIGNEE_LABELS[assigneeChoice(issue.assignee)],
          running ? ISSUES_COPY.running : null,
        ]
          .filter(Boolean)
          .join(", ")}
        accessibilityHint={onLongPress ? ISSUES_COPY.rowHint : undefined}
        onPress={onPress}
        onLongPress={onLongPress}
        testID={`issue-row-${issue.id}`}
      >
        <Surface style={styles.card}>
          <View style={styles.top}>
            <IssuePriorityIcon priority={issue.priority} />
            <ThemedText
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
              style={styles.identifier}
              testID={`issue-row-${issue.id}-identifier`}
            >
              {identifier}
            </ThemedText>
            {running ? <RunningDot label={ISSUES_COPY.running} testID={`issue-row-${issue.id}-running`} /> : null}
            <IssueAssigneeMark assignee={issue.assignee} testID={`issue-row-${issue.id}-assignee`} />
          </View>
          <View style={styles.body}>
            <IssueStatusIcon status={issue.status} />
            <ThemedText variant="body" color={closed ? "textSecondary" : "text"} numberOfLines={2} style={styles.title}>
              {issue.title}
            </ThemedText>
          </View>
          {issue.labels.length > 0 ? (
            <View style={styles.labels}>
              {issue.labels.map((label) => (
                <TagChip key={label} label={label} size="sm" />
              ))}
            </View>
          ) : null}
        </Surface>
      </PressableScale>
    </Animated.View>
  );
};

export default IssueRow;
