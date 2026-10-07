import type { DockerActionKey } from "../../../shared/contracts/docker";
import { IconButton } from "../../components/IconButton";
import { SettingsGroup } from "../../components/PreferenceRows";
import { Spinner } from "../../components/Spinner";
import { CheckRow } from "../shell";
import { DOCKER_LABELS } from "./labels";
import { isPrimaryAction, type CheckView } from "./model";
import styles from "./DockerStep.module.css";

export interface DockerChecksProps {
  rows: readonly CheckView[];
  busy: boolean;
  disabled: boolean;
  onCheck(): void;
  onAction(action: DockerActionKey): void;
}

export function DockerChecks({ rows, busy, disabled, onCheck, onAction }: DockerChecksProps) {
  return (
    <SettingsGroup
      title={DOCKER_LABELS.group}
      headerSuffix={
        busy ? (
          <span className={styles.refreshBusy}>
            <Spinner size={16} label={DOCKER_LABELS.checking} />
          </span>
        ) : (
          <IconButton icon="refresh" label={DOCKER_LABELS.checkAgain} disabled={disabled} onClick={onCheck} />
        )
      }
    >
      {rows.map((row, index) => (
        <CheckRow
          key={row.id}
          index={index}
          title={row.title}
          subtitle={row.subtitle}
          status={row.status}
          action={
            row.action
              ? {
                  label: DOCKER_LABELS.actions[row.action],
                  primary: isPrimaryAction(row.action),
                  disabled,
                  onClick: () => onAction(row.action!),
                }
              : null
          }
        />
      ))}
    </SettingsGroup>
  );
}
