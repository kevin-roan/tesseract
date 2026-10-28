import type { Issue, IssueStatus } from "@tesseract/protocol";
import { FieldGroup, FormDialog, TitleEntry } from "../../../../components/FormDialog";
import { ClaudeCallout } from "./ClaudeCallout";
import { CREATE_DIALOG_WIDTH } from "./constants";
import { useCreateIssue } from "./hooks/use-create-issue";
import { IssuePickers } from "./IssuePickers";
import { CREATE_LABELS as L } from "./labels";
import { LabelsEditor } from "./LabelsEditor";
import type { IssueDraft } from "./types";
import styles from "./IssueForm.module.css";

export interface CreateIssueDialogProps {
  open: boolean;
  projectName: string;
  initialStatus: IssueStatus | null;
  labelSuggestions: readonly string[];
  onCreate(draft: IssueDraft): Promise<Issue | null>;
  onClose(): void;
}

export function CreateIssueDialog({ open, projectName, initialStatus, labelSuggestions, onCreate, onClose }: CreateIssueDialogProps) {
  const form = useCreateIssue(open, initialStatus, onCreate);
  const { draft, set } = form;
  return (
    <FormDialog
      open={open}
      title={L.title}
      context={{ label: projectName, icon: "project" }}
      width={CREATE_DIALOG_WIDTH}
      submitLabel={L.create}
      cancelLabel={L.cancel}
      busy={form.busy}
      submitDisabled={!form.valid}
      onSubmit={() => void form.submit()}
      onClose={onClose}
    >
      <FieldGroup>
        <TitleEntry
          data-autofocus=""
          aria-label={L.titleField}
          placeholder={L.titlePlaceholder}
          value={draft.title}
          onChange={(event) => set.title(event.target.value)}
        />
        <textarea
          className={styles.description}
          aria-label={L.descriptionField}
          placeholder={L.descriptionPlaceholder}
          value={draft.description}
          rows={5}
          onChange={(event) => set.description(event.target.value)}
        />
      </FieldGroup>
      <ClaudeCallout assigned={draft.assignee === "claude"} hint={form.hint} onChange={set.claude} />
      <div className={styles.properties}>
        <IssuePickers
          status={form.status}
          priority={draft.priority}
          assignee={draft.assignee}
          onStatus={set.status}
          onPriority={set.priority}
          onAssignee={set.assignee}
        />
        <LabelsEditor labels={draft.labels} suggestions={labelSuggestions} onChange={set.labels} />
      </div>
    </FormDialog>
  );
}
