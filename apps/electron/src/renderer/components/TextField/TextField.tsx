import { EyeOff } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../../lib/cx";
import { IconButton } from "../IconButton";
import { TEXT_FIELD_LABELS } from "./labels";
import { useReveal } from "./use-reveal";
import styles from "./TextField.module.css";

export type TextFieldSize = "sm" | "md";
export type TextFieldTone = "elevated" | "surface";

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "onSubmit" | "size" | "value" | "type"> {
  value: string;
  onChange?(value: string): void;
  onSubmit?(value: string): void;
  type?: "text" | "url" | "email" | "number" | "search" | "tel";
  password?: boolean;
  error?: boolean;
  size?: TextFieldSize;
  tone?: TextFieldTone;
  mono?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  inputClassName?: string;
}

export function TextField({
  value,
  onChange,
  onSubmit,
  type = "text",
  password = false,
  error = false,
  size = "md",
  tone = "elevated",
  mono = false,
  leading,
  trailing,
  inputRef,
  className,
  inputClassName,
  disabled,
  onKeyDown,
  ...rest
}: TextFieldProps) {
  const reveal = useReveal();
  const masked = password && !reveal.revealed;
  return (
    <div
      className={cx(styles.field, styles[size], styles[tone], className)}
      data-error={error || undefined}
      data-disabled={disabled || undefined}
    >
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <input
        {...rest}
        ref={inputRef}
        type={masked ? "password" : type}
        value={value}
        disabled={disabled}
        aria-invalid={error || undefined}
        spellCheck={rest.spellCheck ?? false}
        className={cx(styles.input, mono ? styles.mono : null, inputClassName)}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && event.key === "Enter" && !event.nativeEvent.isComposing) onSubmit?.(value);
        }}
      />
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
      {password ? (
        <IconButton
          icon={reveal.revealed ? EyeOff : "view-only"}
          label={reveal.revealed ? TEXT_FIELD_LABELS.hide : TEXT_FIELD_LABELS.show}
          size={24}
          className={styles.peek}
          disabled={disabled}
          onClick={reveal.toggle}
        />
      ) : null}
    </div>
  );
}
