import type { Issue } from "@tesseract/protocol";
import { ActionButton } from "../../../../components/ActionButton";
import { ClaudeMark } from "../../../../components/ClaudeMark";
import { Text } from "../../../../components/Text";
import { AgentIndicator } from "./IssueGlyphs";
import { SHEET_LABELS as L } from "./labels";
import { agentIndicator, canDispatch, isClosed } from "./model";
import styles from "./IssueSheet.module.css";

export interface ClaudeRunPanelProps {
  issue: Issue;
  onDispatch(): void;
  onViewRun(runId: string): void;
}

function statusText(issue: Issue): string {
  const indicator = agentIndicator(issue);
  if (indicator === "running") return L.runningClaude;
  if (isClosed(issue.status)) return L.closedClaude;
  return indicator === "failed" ? L.failedClaude : L.idleClaude;
}

export function ClaudeRunPanel({ issue, onDispatch, onViewRun }: ClaudeRunPanelProps) {
  const runId = issue.agentRunId;
  return (
    <section className={styles.claude} aria-label={L.claude}>
      <ClaudeMark size={22} badge />
      <div className={styles.claudeText}>
        <span className={styles.claudeTitle}>
          <Text variant="label">{L.claude}</Text>
          <AgentIndicator issue={issue} />
        </span>
        <Text variant="caption" color="text-secondary" wrap lines={null}>
          {statusText(issue)}
        </Text>
      </div>
      {runId ? <ActionButton size="sm" variant="flat" icon="external" label={L.viewRun} onClick={() => onViewRun(runId)} /> : null}
      <ActionButton size="sm" variant="primary" icon="play" label={L.runClaude} disabled={!canDispatch(issue)} onClick={onDispatch} />
    </section>
  );
}
