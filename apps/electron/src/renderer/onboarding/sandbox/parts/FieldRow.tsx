import { AnimatePresence, motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { PreferenceRow } from "../../../components/PreferenceRows";
import { TextField } from "../../../components/TextField";
import { fade } from "../../../theme/motion";
import styles from "./parts.module.css";

export interface FieldRowProps {
  title: string;
  subtitle?: ReactNode;
  value: string;
  placeholder?: string;
  error?: string | null;
  password?: boolean;
  mono?: boolean;
  disabled?: boolean;
  inputMode?: "text" | "numeric";
  onChange(value: string): void;
}

export function FieldRow({
  title,
  subtitle,
  value,
  placeholder,
  error,
  password,
  mono,
  disabled,
  inputMode,
  onChange,
}: FieldRowProps) {
  const titleId = useId();
  const messageId = useId();
  const below = error ? (
    <AnimatePresence initial={false} mode="wait">
      <motion.span
        key={error}
        id={messageId}
        className={styles.fieldError}
        variants={fade}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {error}
      </motion.span>
    </AnimatePresence>
  ) : (
    subtitle
  );
  return (
    <PreferenceRow
      title={title}
      subtitle={below}
      titleId={titleId}
      disabled={disabled}
      suffix={
        <TextField
          aria-labelledby={titleId}
          aria-describedby={error ? messageId : undefined}
          aria-invalid={error ? true : undefined}
          className={styles.field}
          value={value}
          placeholder={placeholder}
          error={Boolean(error)}
          password={password}
          mono={mono}
          disabled={disabled}
          inputMode={inputMode}
          spellCheck={false}
          onChange={onChange}
        />
      }
    />
  );
}
