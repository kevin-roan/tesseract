import { Icon } from "../../components/Icon";
import { ToneDot } from "../../components/ToneDot";
import { cx } from "../../lib/cx";
import { MACHINE_HOST_ICON, type MachineRow } from "../../features/machines";
import styles from "./MachineMenu.module.css";

export interface MachineMenuItemProps {
  machine: MachineRow;
  onSelect(): void;
}

export function MachineMenuItem({ machine, onSelect }: MachineMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={machine.active}
      tabIndex={-1}
      title={`${machine.apiUrl} · ${machine.statusLabel} · ${machine.hostLabel}`}
      data-selected={machine.active || undefined}
      className={styles.item}
      onClick={onSelect}
    >
      <ToneDot tone={machine.tone} label={machine.statusLabel} />
      <span className={styles.text}>
        <span className={styles.label}>{machine.label}</span>
        <span className={styles.detail}>{machine.detail}</span>
      </span>
      {machine.host ? (
        <Icon name={MACHINE_HOST_ICON} size="sm" label={machine.hostLabel} className={styles.host} />
      ) : null}
      <Icon name="check" className={cx(styles.check, machine.active ? styles.checkVisible : null)} />
    </button>
  );
}
