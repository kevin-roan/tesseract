import { useMemo } from "react";
import { View } from "react-native";
import { ArrowSquareOutIcon, PlayIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import ClaudeMark from "@/components/claude-mark";
import StatusBadge from "@/components/status-badge";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { agentRunTone, stateLabel } from "@/features/sandbox/utils/states";
import { IconSize } from "@/theme";

import type { IssueDetailState } from "../../hooks/use-issue-detail-screen";
import { ISSUE_DETAIL_COPY } from "../../utils/content";
import RunningDot from "../running-dot";
import createStyles from "./styles";

export type IssueClaudePanelProps = {
  claude: IssueDetailState["claude"];
};

const IssueClaudePanel = ({ claude }: IssueClaudePanelProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Surface style={styles.panel} testID="issue-claude">
      <View style={styles.header}>
        <ClaudeMark size={IconSize.md} />
        <ThemedText variant="bodyStrong" style={styles.title}>
          {ISSUE_DETAIL_COPY.claude}
        </ThemedText>
        {claude.running ? <RunningDot label={ISSUE_DETAIL_COPY.running} testID="issue-claude-running" /> : null}
        {claude.agentState ? <StatusBadge label={stateLabel(claude.agentState)} tone={agentRunTone(claude.agentState)} /> : null}
      </View>
      {claude.hint ? (
        <ThemedText variant="bodySmall" color="textSecondary" testID="issue-claude-hint">
          {claude.hint}
        </ThemedText>
      ) : null}
      <View style={styles.actions}>
        <ActionButton
          label={claude.runLabel}
          icon={PlayIcon}
          size="sm"
          onPress={claude.runNow}
          disabled={!claude.canRun}
          loading={claude.dispatching}
          testID="issue-run-claude"
        />
        {claude.viewRun ? (
          <ActionButton
            label={ISSUE_DETAIL_COPY.viewRun}
            icon={ArrowSquareOutIcon}
            variant="secondary"
            size="sm"
            onPress={claude.viewRun}
            testID="issue-view-run"
          />
        ) : null}
      </View>
    </Surface>
  );
};

export default IssueClaudePanel;
