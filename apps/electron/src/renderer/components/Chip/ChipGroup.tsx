import { cx } from "../../lib/cx";
import { Chip } from "./Chip";
import type { ChipGroupSpacing, ChipOption, ChipSize } from "./types";
import { useChipGroup } from "./use-chip-group";
import styles from "./Chip.module.css";

export interface ChipGroupProps<T extends string = string> {
  options: readonly ChipOption<T>[];
  value: NoInfer<T> | null;
  onChange?(id: NoInfer<T>): void;
  ariaLabel: string;
  size?: ChipSize;
  spacing?: ChipGroupSpacing;
  disabled?: boolean;
  className?: string;
}

export function ChipGroup<T extends string = string>({ options, value, onChange, ariaLabel, size = "default", spacing = "default", disabled = false, className }: ChipGroupProps<T>) {
  const group = useChipGroup(options, value, onChange);
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cx(styles.group, spacing === "compact" && styles.compact, className)}
      onKeyDown={disabled ? undefined : group.onKeyDown}
    >
      {options.map((option) => (
        <Chip
          key={option.id}
          kind="radio"
          size={size}
          label={option.label}
          icon={option.icon}
          tooltip={option.tooltip}
          selected={option.id === value}
          disabled={disabled || option.disabled}
          tabIndex={option.id === group.focusId ? 0 : -1}
          data-id={option.id}
          onClick={() => group.select(option.id)}
        />
      ))}
    </div>
  );
}
