import { useEditableText } from "./hooks/use-editable-text";
import { SHEET_LABELS as L } from "./labels";
import styles from "./IssueSheet.module.css";

export interface IssueTitleProps {
  value: string;
  onSave(value: string): void;
}

export function IssueTitle({ value, onSave }: IssueTitleProps) {
  const editor = useEditableText(value, onSave);
  return (
    <input
      className={styles.title}
      aria-label={L.titleField}
      value={editor.text}
      onFocus={editor.begin}
      onBlur={editor.commit}
      onChange={(event) => editor.setText(event.target.value)}
      onKeyDown={editor.onKeyDown}
    />
  );
}
