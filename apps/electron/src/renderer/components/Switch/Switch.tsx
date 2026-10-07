import type { ButtonHTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import styles from "./Switch.module.css";

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "children" | "role"> {
  checked: boolean;
  onChange?(checked: boolean): void;
  label?: string;
}

export function Switch({ checked, onChange, label, disabled, className, onClick, type = "button", ...rest }: SwitchProps) {
  return (
    <button
      {...rest}
      type={type}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-checked={checked || undefined}
      className={cx(styles.track, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onChange?.(!checked);
      }}
    >
      <span className={styles.knob} />
    </button>
  );
}
