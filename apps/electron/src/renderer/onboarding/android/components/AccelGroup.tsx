import type { AccelCheck, AccelResult } from "../../../../shared/contracts/android";
import { IconButton } from "../../../components/IconButton";
import { SettingsGroup } from "../../../components/PreferenceRows";
import { CheckRow, CommandBlock } from "../../shell";
import { ACCEL_COMMANDS, DOC_ACTIONS } from "../constants";
import { ANDROID_LABELS } from "../labels";
import styles from "./groups.module.css";

export interface AccelGroupProps {
  result: AccelResult | null;
  loading: boolean;
  onRecheck(): void;
  onOpenDocs(): void;
  disabled?: boolean;
}

function CheckDetail({ check }: { check: AccelCheck }) {
  const command = check.action ? ACCEL_COMMANDS[check.action] : undefined;
  if (!command) return <>{check.detail}</>;
  return (
    <span className={styles.detailStack}>
      <span>{check.detail}</span>
      <CommandBlock command={command} />
    </span>
  );
}

export function AccelGroup({ result, loading, onRecheck, onOpenDocs, disabled = false }: AccelGroupProps) {
  const checks = result?.checks ?? [];
  return (
    <SettingsGroup
      title={ANDROID_LABELS.accel.title}
      description={ANDROID_LABELS.accel.description}
      headerSuffix={
        <IconButton icon="refresh" label={ANDROID_LABELS.accel.refresh} disabled={loading || disabled} onClick={onRecheck} />
      }
    >
      {checks.length === 0 ? (
        <CheckRow title={ANDROID_LABELS.accel.checking} status={loading ? "running" : "pending"} />
      ) : (
        checks.map((check, index) => (
          <CheckRow
            key={check.id}
            index={index}
            title={check.title}
            subtitle={<CheckDetail check={check} />}
            status={loading ? "running" : check.status}
            action={
              check.action && DOC_ACTIONS.includes(check.action)
                ? { label: ANDROID_LABELS.accel.openDocs, onClick: onOpenDocs }
                : null
            }
          />
        ))
      )}
    </SettingsGroup>
  );
}
