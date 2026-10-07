import { useId } from "react";
import { TextField, type TextFieldProps } from "../TextField";
import { PreferenceRow } from "./PreferenceRow";
import styles from "./PreferenceRows.module.css";

export interface EntryRowProps extends Omit<TextFieldProps, "onSubmit" | "title"> {
  title: string;
  subtitle?: string;
  onActivate?(value: string): void;
  rowDisabled?: boolean;
}

export function EntryRow({ title, subtitle, onActivate, rowDisabled, ...field }: EntryRowProps) {
  const titleId = useId();
  return (
    <PreferenceRow
      title={title}
      subtitle={subtitle}
      titleId={titleId}
      disabled={rowDisabled}
      suffix={<TextField aria-labelledby={titleId} {...field} onSubmit={onActivate} className={styles.entry} />}
    />
  );
}
