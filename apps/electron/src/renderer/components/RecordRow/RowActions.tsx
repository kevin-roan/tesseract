import { cx } from "../../lib/cx";
import { ActionButton } from "../ActionButton";
import { IconButton } from "../IconButton";
import type { RowAction } from "./types";
import styles from "./RecordRow.module.css";

export interface RowActionsProps {
  actions: readonly RowAction[];
}

export function RowActions({ actions }: RowActionsProps) {
  return (
    <div className={styles.actions}>
      {actions.map((action) =>
        action.labeled ? (
          <ActionButton
            key={action.id}
            size="sm"
            variant={action.destructive ? "destructive" : "secondary"}
            muted={!action.destructive}
            icon={action.icon}
            label={action.label}
            className={styles.labeledAction}
            disabled={action.sensitive === false}
            data-active={action.active || undefined}
            onClick={action.onActivate}
          />
        ) : (
          <IconButton
            key={action.id}
            icon={action.icon}
            label={action.label}
            size={24}
            checked={action.active}
            disabled={action.sensitive === false}
            className={cx(styles.iconAction, action.destructive && styles.destructive)}
            onClick={action.onActivate}
          />
        ),
      )}
    </div>
  );
}
