import { useId } from "react";
import { IconButton } from "../../../../components/IconButton";
import { useLabelInput } from "./hooks/use-label-input";
import { LABEL_EDITOR_LABELS as L } from "./labels";
import styles from "./IssueForm.module.css";

export interface LabelsEditorProps {
  labels: readonly string[];
  suggestions?: readonly string[];
  onChange(labels: string[]): void;
  disabled?: boolean;
}

export function LabelsEditor({ labels, suggestions = [], onChange, disabled = false }: LabelsEditorProps) {
  const input = useLabelInput(labels, onChange);
  const listId = useId();
  const options = suggestions.filter((suggestion) => !labels.includes(suggestion));
  return (
    <div className={styles.labelsEditor} role="group" aria-label={L.field}>
      {labels.map((label) => (
        <span key={label} className={styles.labelChip}>
          {label}
          <IconButton icon="close" size={22} iconSize={12} label={L.remove(label)} disabled={disabled} onClick={() => input.remove(label)} />
        </span>
      ))}
      <input
        className={styles.labelInput}
        value={input.text}
        placeholder={L.add}
        aria-label={L.add}
        list={options.length > 0 ? listId : undefined}
        disabled={disabled}
        onChange={(event) => input.setText(event.target.value)}
        onKeyDown={input.onKeyDown}
        onBlur={input.commit}
      />
      {options.length > 0 ? (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
