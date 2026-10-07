import { Icon } from "../../../components/Icon";
import { Tooltip } from "../../../components/Tooltip";
import type { IconName } from "../../../theme/icons";
import styles from "./dialogs.module.css";

export interface ToggleChipProps {
  label: string;
  icon: IconName;
  active: boolean;
  onToggle(): void;
  tooltip?: string;
  disabled?: boolean;
}

export function ToggleChip({ label, icon, active, onToggle, tooltip, disabled }: ToggleChipProps) {
  const chip = (
    <button type="button" className={styles.chip} aria-pressed={active} disabled={disabled} onClick={onToggle}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
  return tooltip ? <Tooltip label={tooltip}>{chip}</Tooltip> : chip;
}
