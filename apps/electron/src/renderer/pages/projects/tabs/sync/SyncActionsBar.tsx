import { ActionButton } from "../../../../components/ActionButton";
import type { SyncActionButton } from "./hooks/use-sync-actions";
import { SYNC_LABELS } from "./labels";
import styles from "./SyncTab.module.css";

export interface SyncActionsBarProps {
  buttons: SyncActionButton[];
}

export function SyncActionsBar({ buttons }: SyncActionsBarProps) {
  return (
    <div role="toolbar" aria-label={SYNC_LABELS.actions} className={styles.actions}>
      {buttons.map((button) => (
        <ActionButton
          key={button.id}
          label={button.label}
          icon={button.icon}
          variant={button.variant}
          disabled={button.disabled}
          tooltip={button.tooltip}
          onClick={button.onClick}
          className={styles.action}
        />
      ))}
    </div>
  );
}
