import { EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type Ref } from "react";
import { cx } from "../../lib/cx";
import { IconButton } from "../IconButton";
import { useFieldId } from "./field-context";
import { FORM_LABELS } from "./labels";
import styles from "./FormDialog.module.css";

export interface FormEntryProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  error?: boolean;
  password?: boolean;
  monospace?: boolean;
  tone?: "surface" | "elevated";
  ref?: Ref<HTMLInputElement>;
}

export function FormEntry({
  error = false,
  password = false,
  monospace = false,
  tone = "surface",
  className,
  type = "text",
  disabled,
  ref,
  ...rest
}: FormEntryProps) {
  const [peek, setPeek] = useState(false);
  const fieldId = useFieldId();
  return (
    <div
      className={cx(
        styles.entry,
        tone === "elevated" && styles.entryElevated,
        error && styles.entryError,
        disabled && styles.entryDisabled,
        className,
      )}
    >
      <input
        {...rest}
        ref={ref}
        id={rest.id ?? fieldId}
        disabled={disabled}
        type={password && !peek ? "password" : password ? "text" : type}
        aria-invalid={error || undefined}
        className={cx(styles.input, monospace && styles.mono)}
        spellCheck={password || monospace ? false : rest.spellCheck}
        autoComplete={password ? "off" : rest.autoComplete}
      />
      {password ? (
        <IconButton
          icon={peek ? EyeOff : "view-only"}
          label={peek ? FORM_LABELS.hideText : FORM_LABELS.showText}
          size={24}
          className={styles.peek}
          onClick={() => setPeek((value) => !value)}
          disabled={disabled}
          tabIndex={-1}
        />
      ) : null}
    </div>
  );
}
