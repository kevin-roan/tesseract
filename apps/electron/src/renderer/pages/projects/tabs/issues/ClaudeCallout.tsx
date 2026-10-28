import { ClaudeMark } from "../../../../components/ClaudeMark";
import { Switch } from "../../../../components/Switch";
import { Text } from "../../../../components/Text";
import { CREATE_LABELS as L } from "./labels";
import type { ClaudeHint } from "./types";
import styles from "./IssueForm.module.css";

export interface ClaudeCalloutProps {
  assigned: boolean;
  hint: ClaudeHint;
  onChange(assigned: boolean): void;
}

export function ClaudeCallout({ assigned, hint, onChange }: ClaudeCalloutProps) {
  return (
    <div className={styles.callout} data-active={assigned || undefined}>
      <ClaudeMark size={22} badge />
      <div className={styles.calloutText}>
        <Text variant="label">{L.assignClaude}</Text>
        <Text variant="caption" color="text-secondary" wrap lines={null}>
          {hint ? L.claudeHints[hint] : L.claudeOff}
        </Text>
      </div>
      <Switch checked={assigned} label={L.assignClaude} onChange={onChange} />
    </div>
  );
}
