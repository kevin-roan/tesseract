import type { ServerContainer } from "../../../../shared/contracts/containers";
import { ActionButton } from "../../../components/ActionButton";
import { StatusBadge } from "../../../components/StatusBadge";
import { Text } from "../../../components/Text";
import { CONTAINERS_LABELS as L } from "../../../features/containers/labels";
import { containerSubtitle, containerTone } from "../../../features/containers/model";
import styles from "./ContainerDetail.module.css";

export interface ContainerHeaderProps {
  container: ServerContainer;
  busy: boolean;
  onStart(): void;
  onStop(): void;
  onRestart(): void;
  onDelete(): void;
}

export function ContainerHeader({ container, busy, onStart, onStop, onRestart, onDelete }: ContainerHeaderProps) {
  const running = container.state === "running";
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <Text as="h1" variant="h1" selectable className={styles.title}>
          {container.name}
        </Text>
        <StatusBadge label={L.states[container.state]} tone={containerTone(container.state)} live={running} />
      </div>
      <Text variant="caption" color="text-secondary">
        {containerSubtitle(container, 0)}
      </Text>
      <div className={styles.actions}>
        {running ? (
          <ActionButton icon="stop" label={L.actions.stop} busy={busy} disabled={busy} onClick={onStop} />
        ) : (
          <ActionButton variant="primary" icon="play" label={L.actions.start} busy={busy} disabled={busy} onClick={onStart} />
        )}
        <ActionButton icon="refresh" label={L.actions.restart} disabled={busy || !running} onClick={onRestart} />
        <ActionButton variant="destructive" icon="delete" label={L.actions.delete} disabled={busy} onClick={onDelete} />
      </div>
    </header>
  );
}
