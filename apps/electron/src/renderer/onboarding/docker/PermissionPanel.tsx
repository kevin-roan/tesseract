import { ActionButton } from "../../components/ActionButton";
import { Notice } from "../../components/Notice";
import { CommandBlock } from "../shell";
import { DOCKER_LABELS } from "./labels";
import styles from "./DockerStep.module.css";

export interface PermissionPanelProps {
  busy: boolean;
  onAddToGroup(): void;
}

export function PermissionPanel({ busy, onAddToGroup }: PermissionPanelProps) {
  return (
    <div className={styles.panel}>
      <Notice tone="warning" message={DOCKER_LABELS.permission.message} />
      <div className={styles.panelActions}>
        <ActionButton variant="secondary" label={DOCKER_LABELS.permission.addMe} busy={busy} disabled={busy} onClick={onAddToGroup} />
      </div>
      <CommandBlock command={DOCKER_LABELS.permission.command} />
    </div>
  );
}
