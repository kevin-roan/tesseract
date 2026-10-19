import { ActionButton } from "../../../components/ActionButton";
import { PreferenceRow } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import type { MasterHostRow as MasterHostRowModel } from "./model";
import styles from "./ConnectionPreferences.module.css";

export interface MasterHostRowProps {
  title: string;
  row: MasterHostRowModel;
  pairLabel: string;
  unlinkLabel: string;
  busy: boolean;
  disabled?: boolean;
  onPair(): void;
  onUnlink(): void;
}

export function MasterHostRow({ title, row, pairLabel, unlinkLabel, busy, disabled, onPair, onUnlink }: MasterHostRowProps) {
  return (
    <PreferenceRow
      title={title}
      subtitle={row.subtitle}
      suffix={
        <span className={styles.controls}>
          <StatusBadge label={row.badge.label} tone={row.badge.tone} />
          {row.canUnlink ? <ActionButton size="dialog" label={unlinkLabel} busy={busy} disabled={busy || disabled} onClick={onUnlink} /> : null}
          <ActionButton size="dialog" label={pairLabel} disabled={disabled} onClick={onPair} />
        </span>
      }
    />
  );
}
