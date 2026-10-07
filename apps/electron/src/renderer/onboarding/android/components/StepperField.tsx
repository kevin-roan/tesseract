import { IconButton } from "../../../components/IconButton";
import { clampStep } from "../model";
import { useNumberDraft } from "../../shared/use-number-draft";
import styles from "./StepperField.module.css";

export interface StepperFieldProps {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  onChange(value: number): void;
  disabled?: boolean;
}

export function StepperField({ value, min, max, step, unit, label, decreaseLabel, increaseLabel, onChange, disabled = false }: StepperFieldProps) {
  const draft = useNumberDraft({ value, min, max, step, clamp: (next) => clampStep(next, min, max, step), onCommit: onChange });
  return (
    <span className={styles.stepper} data-disabled={disabled || undefined}>
      <span className={styles.field}>
        <IconButton icon="minus" label={decreaseLabel} size={24} tooltip={null} disabled={disabled || value <= min} onClick={() => draft.nudge(-step)} />
        <input
          className={styles.input}
          inputMode="numeric"
          aria-label={label}
          value={draft.text}
          aria-invalid={draft.invalid || undefined}
          data-invalid={draft.invalid || undefined}
          disabled={disabled}
          onChange={draft.onChange}
          onBlur={draft.onBlur}
          onKeyDown={draft.onKeyDown}
        />
        <IconButton icon="add" label={increaseLabel} size={24} tooltip={null} disabled={disabled || value >= max} onClick={() => draft.nudge(step)} />
      </span>
      <span className={styles.unit}>{unit}</span>
    </span>
  );
}
