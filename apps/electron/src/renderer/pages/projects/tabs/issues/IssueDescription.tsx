import { ActionButton } from "../../../../components/ActionButton";
import { MarkdownView } from "../../../../components/MarkdownView";
import { Text } from "../../../../components/Text";
import { useEditableText } from "./hooks/use-editable-text";
import { SHEET_LABELS as L } from "./labels";
import styles from "./IssueSheet.module.css";

export interface IssueDescriptionProps {
  value: string;
  onSave(value: string): void;
}

export function IssueDescription({ value, onSave }: IssueDescriptionProps) {
  const editor = useEditableText(value, onSave);
  return (
    <section className={styles.section} aria-label={L.description}>
      <div className={styles.sectionHeader}>
        <Text variant="overline" color="text-secondary">
          {L.description}
        </Text>
        {editor.editing ? null : <ActionButton size="sm" variant="flat" icon="rename" label={L.edit} onClick={editor.begin} />}
      </div>
      {editor.editing ? (
        <>
          <textarea
            className={styles.descriptionInput}
            aria-label={L.descriptionField}
            placeholder={L.descriptionPlaceholder}
            value={editor.text}
            rows={8}
            autoFocus
            onChange={(event) => editor.setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                editor.commit();
              }
            }}
          />
          <div className={styles.editActions}>
            <ActionButton size="sm" variant="flat" label={L.cancel} onClick={editor.cancel} />
            <ActionButton size="sm" variant="primary" label={L.save} shortcut="CmdOrCtrl+Enter" onClick={editor.commit} />
          </div>
        </>
      ) : value.trim() ? (
        <MarkdownView text={value} className={styles.markdown} />
      ) : (
        <Text variant="body" color="text-tertiary" wrap lines={null}>
          {L.noDescription}
        </Text>
      )}
    </section>
  );
}
