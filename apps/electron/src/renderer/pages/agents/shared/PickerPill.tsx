import { ChoiceDropdown, type ChoiceOption } from "../../../components/ChoiceDropdown";
import { Icon } from "../../../components/Icon";
import type { IconName } from "../../../theme/icons";
import { GLYPH_SIZE } from "./constants";
import styles from "./PickerPill.module.css";

export interface PickerPillProps<T extends string> {
  icon: IconName;
  options: readonly ChoiceOption<T>[];
  value: NoInfer<T>;
  tooltip: string;
  disabled?: boolean;
  onChange(id: NoInfer<T>): void;
}

export function PickerPill<T extends string>({ icon, options, value, tooltip, disabled, onChange }: PickerPillProps<T>) {
  return (
    <div className={styles.pill}>
      <Icon name={icon} size={GLYPH_SIZE} color="text-secondary" />
      <ChoiceDropdown options={options} value={value} onChange={onChange} tooltip={tooltip} disabled={disabled} className={styles.dropdown} />
    </div>
  );
}
