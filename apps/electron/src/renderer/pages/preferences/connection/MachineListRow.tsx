import { ActionButton } from "../../../components/ActionButton";
import { IconButton } from "../../../components/IconButton";
import { PreferenceRow } from "../../../components/PreferenceRows";
import { StatusBadge } from "../../../components/StatusBadge";
import { ToneDot } from "../../../components/ToneDot";
import type { MachineRow } from "../../../features/machines";
import styles from "./ConnectionPreferences.module.css";

export interface MachineListRowProps {
  machine: MachineRow;
  subtitle: string;
  activeLabel: string;
  switchLabel: string;
  moreLabel: string;
  menuOpen: boolean;
  disabled?: boolean;
  onSwitch(): void;
  onMore(element: HTMLElement): void;
}

export function MachineListRow({ machine, subtitle, activeLabel, switchLabel, moreLabel, menuOpen, disabled, onSwitch, onMore }: MachineListRowProps) {
  return (
    <PreferenceRow
      prefix={<ToneDot tone={machine.tone} label={machine.statusLabel} />}
      title={machine.label}
      subtitle={subtitle}
      suffix={
        <span className={styles.controls}>
          {machine.active ? (
            <StatusBadge label={activeLabel} tone="success" icon="check" />
          ) : (
            <ActionButton size="dialog" label={switchLabel} disabled={disabled} onClick={onSwitch} />
          )}
          <IconButton icon="more" label={moreLabel} checked={menuOpen} onClick={(event) => onMore(event.currentTarget)} />
        </span>
      }
    />
  );
}
