import { cx } from "../../../lib/cx";
import styles from "./parts.module.css";

export interface ModelChip<T extends string> {
  id: T;
  label: string;
}

export interface ModelChipsProps<T extends string> {
  label: string;
  chips: readonly ModelChip<T>[];
  selected: readonly T[];
  disabled?: boolean;
  onToggle(id: T): void;
}

export function ModelChips<T extends string>({ label, chips, selected, disabled = false, onToggle }: ModelChipsProps<T>) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {chips.map((chip) => {
        const on = selected.includes(chip.id);
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            className={cx(styles.chip, on && styles.chipOn)}
            onClick={() => onToggle(chip.id)}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
