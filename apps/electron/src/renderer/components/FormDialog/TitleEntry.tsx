import type { InputHTMLAttributes, Ref } from "react";
import { cx } from "../../lib/cx";
import { useFieldId } from "./field-context";
import styles from "./FormDialog.module.css";

export interface TitleEntryProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  monospace?: boolean;
  error?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function TitleEntry({ monospace = false, error = false, className, ref, ...rest }: TitleEntryProps) {
  const fieldId = useFieldId();
  return (
    <input
      {...rest}
      id={rest.id ?? fieldId}
      ref={ref}
      type="text"
      aria-invalid={error || undefined}
      className={cx(styles.titleEntry, monospace && styles.titleMono, error && styles.titleError, className)}
    />
  );
}
