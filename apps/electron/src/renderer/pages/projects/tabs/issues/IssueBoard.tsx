import type { Issue, IssueStatus } from "@tesseract/protocol";
import { IconButton } from "../../../../components/IconButton";
import { Text } from "../../../../components/Text";
import { cx } from "../../../../lib/cx";
import type { BoardDrag } from "./hooks/use-board-drag";
import { IssueCard } from "./IssueCard";
import { StatusIcon } from "./IssueGlyphs";
import { ISSUES_LABELS as L, STATUS_LABELS } from "./labels";
import type { IssueColumn } from "./types";
import styles from "./IssueBoard.module.css";

export interface IssueBoardProps {
  columns: readonly IssueColumn<Issue>[];
  drag: BoardDrag;
  onOpen(id: string): void;
  onCreate(status: IssueStatus): void;
}

export function IssueBoard({ columns, drag, onOpen, onCreate }: IssueBoardProps) {
  return (
    <div className={styles.board} role="group" aria-label={L.board}>
      {columns.map(({ status, issues }) => {
        const label = STATUS_LABELS[status];
        const target = drag.over?.status === status;
        return (
          <section
            key={status}
            className={cx(styles.column, target && styles.columnTarget)}
            aria-label={label}
            onDragOver={(event) => drag.overColumn(status, event)}
            onDrop={drag.drop}
          >
            <header className={styles.columnHeader}>
              <StatusIcon status={status} />
              <Text variant="label">{label}</Text>
              <Text variant="caption" color="text-tertiary" tabular>
                {String(issues.length)}
              </Text>
              <span className={styles.spacer} />
              <IconButton icon="add" size={22} label={L.newIssueIn(label)} onClick={() => onCreate(status)} />
            </header>
            <ul className={styles.cards} aria-label={label} data-drop-end={(target && drag.over?.beforeId === null) || undefined}>
              {issues.map((issue, index) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  dragging={drag.draggingId === issue.id}
                  dropBefore={target && drag.over?.beforeId === issue.id}
                  onOpen={onOpen}
                  onDragStart={drag.start}
                  onDragOver={(event) => drag.overCard(status, issue.id, issues[index + 1]?.id ?? null, event)}
                  onDragEnd={drag.end}
                />
              ))}
              {issues.length === 0 ? (
                <li className={styles.emptyColumn}>
                  <Text variant="caption" color="text-tertiary">
                    {L.emptyColumn}
                  </Text>
                </li>
              ) : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
