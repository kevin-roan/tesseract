import type { Project } from "@theone/protocol";
import { useEffect } from "react";
import { FieldGroup, FormDialog, TitleEntry } from "../../../components/FormDialog";
import { PROJECTS_ICONS, PROJECTS_ROOT, RENAME_DIALOG_WIDTH } from "../../../features/projects/constants";
import { useRenameProject } from "../../../features/projects/hooks/use-rename-project";
import { RENAME_LABELS } from "../../../features/projects/labels";

export interface RenameProjectDialogProps {
  open: boolean;
  project: Project;
  onRenamed(project: Project): void;
  onClose(): void;
}

export function RenameProjectDialog({ open, project, onRenamed, onClose }: RenameProjectDialogProps) {
  const form = useRenameProject(project, onRenamed, onClose);
  const { reset } = form;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  return (
    <FormDialog
      open={open}
      title={RENAME_LABELS.title}
      subtitle={RENAME_LABELS.subtitle(PROJECTS_ROOT, project.id)}
      context={{ label: form.context, icon: PROJECTS_ICONS.project }}
      width={RENAME_DIALOG_WIDTH}
      submitLabel={RENAME_LABELS.save}
      cancelLabel={RENAME_LABELS.cancel}
      onSubmit={() => void form.submit()}
      onClose={onClose}
      error={form.error}
      busy={form.busy}
    >
      <FieldGroup description={RENAME_LABELS.hint} errors={form.fields.errorsFor("name")}>
        <TitleEntry autoFocus placeholder={RENAME_LABELS.name} aria-label={RENAME_LABELS.name} {...form.fields.field("name")} />
      </FieldGroup>
    </FormDialog>
  );
}
