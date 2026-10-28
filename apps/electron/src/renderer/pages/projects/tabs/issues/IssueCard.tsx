import type { Issue } from "@tesseract/protocol";
import type { DragEvent } from "react";
import { Text } from "../../../../components/Text";
import { cx } from "../../../../lib/cx";
import { AgentIndicator, AssigneeAvatar, LabelPills, PriorityIcon } from "./IssueGlyphs";
import { issueIdentifier } from "./model";
import styles from "./IssueBoard.module.css";

export interface IssueCardProps {
  issue: Issue;
  dragging?: boolean;
  dropBefore?: boolean;
  onOpen(id: string): void;
  onDragStart?(id: string, event: DragEvent): void;
  onDragOver?(event: DragEvent<HTMLElement>): void;
  onDragEnd?(): void;
}

export function IssueCard({ issue, dragging = false, dropBefore = false, onOpen, onDragStart, onDragOver, onDragEnd }: IssueCardProps) {
  const identifier = issueIdentifier(issue);
  return (
    <li className={styles.cardSlot} data-drop-before={dropBefore || undefined} onDragOver={onDragOver}>
      <button
        type="button"
        className={cx(styles.card, dragging && styles.dragging)}
        draggable={onDragStart !== undefined}
        aria-label={`${identifier} ${issue.title}`}
        onClick={() => onOpen(issue.id)}
        onDragStart={onDragStart ? (event) => onDragStart(issue.id, event) : undefined}
        onDragEnd={onDragEnd}
      >
        <span className={styles.cardTop}>
          <Text variant="caption" color="text-tertiary" tabular>
            {identifier}
          </Text>
          <span className={styles.cardTrailing}>
            <AgentIndicator issue={issue} />
            <AssigneeAvatar assignee={issue.assignee} />
          </span>
        </span>
        <Text variant="body" wrap lines={3} className={styles.cardTitle}>
          {issue.title}
        </Text>
        <span className={styles.cardMeta}>
          <PriorityIcon priority={issue.priority} />
          <LabelPills labels={issue.labels} />
        </span>
      </button>
    </li>
  );
}
