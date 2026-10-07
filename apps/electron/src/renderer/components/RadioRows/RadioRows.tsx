import { useCallback, useMemo } from "react";
import { PreferenceRow } from "../PreferenceRows";
import { RadioIndicator } from "./RadioIndicator";
import { useRadioKeys } from "./use-radio-keys";
import styles from "./RadioRows.module.css";

export interface RadioChoice<T extends string = string> {
  id: T;
  title: string;
  subtitle?: string;
  available?: boolean;
}

export interface RadioRowsProps<T extends string = string> {
  choices: readonly RadioChoice<T>[];
  value: NoInfer<T> | null;
  onSelect?(id: NoInfer<T>): void;
  busy?: boolean;
}

export function RadioRows<T extends string = string>({ choices, value, onSelect, busy = false }: RadioRowsProps<T>) {
  const enabled = useMemo(
    () => (busy ? [] : choices.filter((choice) => choice.available !== false).map((choice) => choice.id)),
    [busy, choices],
  );
  const select = useCallback(
    (id: T) => {
      if (id !== value && enabled.includes(id)) onSelect?.(id);
    },
    [enabled, onSelect, value],
  );
  const onArrow = useRadioKeys(enabled, select);
  const focusable = value !== null && enabled.includes(value) ? value : enabled[0];
  return (
    <>
      {choices.map((choice) => {
        const checked = choice.id === value;
        const disabled = busy || choice.available === false;
        return (
          <PreferenceRow
            key={choice.id}
            role="radio"
            className={styles.row}
            aria-checked={checked}
            title={choice.title}
            subtitle={choice.subtitle}
            disabled={disabled}
            tabIndex={choice.id === focusable ? 0 : -1}
            prefix={<RadioIndicator checked={checked} className={styles.rowRadio} />}
            onActivate={() => select(choice.id)}
            onKeyDown={(event) => onArrow(event, choice.id)}
          />
        );
      })}
    </>
  );
}
