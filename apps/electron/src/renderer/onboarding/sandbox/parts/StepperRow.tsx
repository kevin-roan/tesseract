import { useId, type ReactNode } from "react";
import { IconButton } from "../../../components/IconButton";
import { PreferenceRow } from "../../../components/PreferenceRows";
import { Text } from "../../../components/Text";
import { STEPPER_BUTTON_SIZE } from "../constants";
import { clampInt } from "../model";
import { useNumberDraft } from "../../shared/use-number-draft";
import styles from "./parts.module.css";

export interface StepperRowProps {
  title: string;
  subtitle?: ReactNode;
  value: number;
  min: number;
  max: number;
  unit: string;
  decreaseLabel: string;
  increaseLabel: string;
  disabled?: boolean;
  onChange(value: number): void;
}

export function StepperRow({
  title,
  subtitle,
  value,
  min,
  max,
  unit,
  decreaseLabel,
  increaseLabel,
  disabled = false,
  onChange,
}: StepperRowProps) {
  const titleId = useId();
  const draft = useNumberDraft({ value, min, max, clamp: (next) => clampInt(next, min, max), onCommit: onChange });
  return (
    <PreferenceRow
      title={title}
      subtitle={subtitle}
      titleId={titleId}
      disabled={disabled}
      suffix={
        <>
          <div className={styles.stepper} data-disabled={disabled || undefined}>
            <IconButton
              icon="minus"
              label={decreaseLabel}
              tooltip={null}
              size={STEPPER_BUTTON_SIZE}
              disabled={disabled || value <= min}
              onClick={() => draft.nudge(-1)}
            />
            <input
              className={styles.stepperInput}
              aria-labelledby={titleId}
              inputMode="numeric"
              value={draft.text}
              aria-invalid={draft.invalid || undefined}
              data-invalid={draft.invalid || undefined}
              disabled={disabled}
              onChange={draft.onChange}
              onBlur={draft.onBlur}
              onKeyDown={draft.onKeyDown}
            />
            <IconButton
              icon="add"
              label={increaseLabel}
              tooltip={null}
              size={STEPPER_BUTTON_SIZE}
              disabled={disabled || value >= max}
              onClick={() => draft.nudge(1)}
            />
          </div>
          <Text variant="caption" color="text-tertiary" className={styles.unit}>
            {unit}
          </Text>
        </>
      }
    />
  );
}
