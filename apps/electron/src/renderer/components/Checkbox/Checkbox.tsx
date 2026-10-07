import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { cx } from "../../lib/cx";
import { CHECK_GLYPH } from "./constants";
import styles from "./Checkbox.module.css";

export type CheckboxValue = boolean | "mixed";

export interface CheckboxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "children" | "role"> {
  checked: CheckboxValue;
  onChange?(checked: boolean): void;
  label?: string;
  ariaLabel?: string;
}

export function Checkbox({ checked, onChange, label, ariaLabel, disabled, className, onClick, type = "button", ...rest }: CheckboxProps) {
  const mixed = checked === "mixed";
  const on = checked === true || mixed;
  const path = mixed ? CHECK_GLYPH.mixedPath : CHECK_GLYPH.checkPath;
  const length = mixed ? CHECK_GLYPH.mixedLength : CHECK_GLYPH.checkLength;
  return (
    <button
      {...rest}
      type={type}
      role="checkbox"
      aria-checked={checked === "mixed" ? "mixed" : checked}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled}
      data-checked={on || undefined}
      className={cx(styles.root, label ? styles.withLabel : null, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onChange?.(!(checked === true));
      }}
    >
      <span className={styles.box}>
        <svg viewBox={CHECK_GLYPH.viewBox} className={styles.glyph} aria-hidden focusable={false}>
          <path
            key={mixed ? "mixed" : "check"}
            d={path}
            className={styles.stroke}
            strokeWidth={CHECK_GLYPH.strokeWidth}
            style={{ "--checkbox-length": length } as CSSProperties}
          />
        </svg>
      </span>
      {label ? <span className={styles.label}>{label}</span> : null}
    </button>
  );
}
