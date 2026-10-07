import type { KeyboardEvent, MouseEvent } from "react";
import { Icon } from "../../components/Icon";
import { Text } from "../../components/Text";
import { ToneDot } from "../../components/ToneDot";
import { Tooltip } from "../../components/Tooltip";
import { ACTION_LABELS, META_LABELS } from "../../features/terminals/labels";
import type { SessionRowModel } from "../../features/terminals/types";
import { cx } from "../../lib/cx";
import styles from "./SessionRow.module.css";

export interface SessionRowProps {
  row: SessionRowModel;
  selected: boolean;
  onSelect(id: string): void;
  onDelete(id: string): void;
}

export function SessionRow({ row, selected, onSelect, onDelete }: SessionRowProps) {
  const deleteLabel = row.running ? ACTION_LABELS.deleteRunning : ACTION_LABELS.delete;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(row.id);
    }
  };
  const remove = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDelete(row.id);
  };
  return (
    <Tooltip label={`${row.title}${META_LABELS.separator}${row.status}`} placement="right">
      <div
        role="option"
        tabIndex={0}
        aria-selected={selected}
        data-selected={selected || undefined}
        data-ended={!row.running || undefined}
        className={styles.row}
        onClick={() => onSelect(row.id)}
        onKeyDown={onKeyDown}
      >
        <span className={cx(styles.icon, styles.dimmable)}>
          <Icon name={row.icon} size={16} color="text-secondary" />
        </span>
        <span className={cx(styles.text, styles.dimmable)}>
          <Text variant="body">{row.title}</Text>
          <Text variant="caption" color="text-tertiary">
            {row.subtitle}
          </Text>
        </span>
        <span className={styles.trailing}>
          <span className={styles.dot}>
            <ToneDot tone={row.tone} size={6} label={row.status} />
          </span>
          <Tooltip label={deleteLabel}>
            <button type="button" className={styles.delete} aria-label={deleteLabel} onClick={remove}>
              <Icon name="delete" size={16} />
            </button>
          </Tooltip>
        </span>
      </div>
    </Tooltip>
  );
}
