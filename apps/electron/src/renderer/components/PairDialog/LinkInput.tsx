import { ActionButton } from "../ActionButton";
import { Text } from "../Text";
import { TextField } from "../TextField";
import type { PairLinkInput } from "./model";
import styles from "./PairDialog.module.css";

export interface LinkInputProps {
  descriptor: PairLinkInput;
  value: string;
  error: string | null;
  busy: boolean;
  onChange(value: string): void;
  onSubmit(): void;
}

export function LinkInput({ descriptor, value, error, busy, onChange, onSubmit }: LinkInputProps) {
  return (
    <div className={styles.linkInput}>
      <div className={styles.linkInputRow}>
        <TextField
          className={styles.linkInputField}
          tone="surface"
          mono
          value={value}
          error={error !== null}
          placeholder={descriptor.placeholder}
          aria-label={descriptor.label}
          spellCheck={false}
          autoComplete="off"
          disabled={busy}
          onChange={onChange}
          onSubmit={onSubmit}
        />
        <ActionButton label={descriptor.submitLabel} busy={busy} disabled={!value.trim()} onClick={onSubmit} />
      </div>
      {error ? (
        <div role="alert">
          <Text variant="caption" color="danger" wrap lines={null} selectable>
            {error}
          </Text>
        </div>
      ) : null}
    </div>
  );
}
