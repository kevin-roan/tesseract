import type { Project } from "@theone/protocol";
import { useEffect } from "react";
import { FieldGroup, FormDialog, FormEntry, FormField, PropertyChips, TitleEntry } from "../../../components/FormDialog";
import { IconButton } from "../../../components/IconButton";
import { Crossfade } from "../../../components/Presence";
import { CREATE_DIALOG_WIDTH, PROJECTS_ICONS } from "../../../features/projects/constants";
import { useCreateProject } from "../../../features/projects/hooks/use-create-project";
import { CREATE_LABELS } from "../../../features/projects/labels";
import { CloneProgress } from "./CloneProgress";
import { ToggleChip } from "./ToggleChip";
import styles from "./dialogs.module.css";

export interface CreateProjectDialogProps {
  open: boolean;
  onClose(): void;
  onCreated(project: Project): void;
}

export function CreateProjectDialog({ open, onClose, onCreated }: CreateProjectDialogProps) {
  const form = useCreateProject(onCreated, onClose);
  const { reset } = form;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const cloning = form.clone !== null;
  const name = form.fields.field("name");

  return (
    <FormDialog
      open={open}
      title={CREATE_LABELS.title}
      context={{ label: CREATE_LABELS.context, icon: PROJECTS_ICONS.project }}
      width={CREATE_DIALOG_WIDTH}
      submitLabel={cloning ? (form.finished ? form.openLabel : null) : form.submitLabel}
      cancelLabel={cloning ? CREATE_LABELS.close : CREATE_LABELS.cancel}
      onSubmit={cloning ? form.openCloned : () => void form.submit()}
      onClose={form.close}
      error={cloning ? null : form.error}
      busy={form.busy}
    >
      <Crossfade id={cloning ? "progress" : "form"}>
        {form.clone ? (
          <CloneProgress job={form.clone} outcome={form.outcome} onExit={form.cloneExited} />
        ) : (
          <div className={styles.progress}>
            <FieldGroup description={form.hint} errors={form.fields.errorsFor("name")}>
              <div className={styles.titleRow}>
                <TitleEntry
                  autoFocus
                  placeholder={CREATE_LABELS.name}
                  aria-label={CREATE_LABELS.name}
                  readOnly={form.confidential}
                  {...name}
                />
                {form.confidential ? (
                  <IconButton icon={PROJECTS_ICONS.shuffle} label={CREATE_LABELS.newPseudonym} size={24} onClick={form.reroll} />
                ) : null}
              </div>
            </FieldGroup>
            <FieldGroup title={CREATE_LABELS.cloneFrom} description={form.sourceHint} errors={form.fields.errorsFor("git_url", "branch")}>
              <FormField label={CREATE_LABELS.gitUrl}>
                <FormEntry spellCheck={false} {...form.fields.field("git_url")} />
              </FormField>
              <FormField label={CREATE_LABELS.branch}>
                <FormEntry spellCheck={false} {...form.fields.field("branch")} />
              </FormField>
            </FieldGroup>
            <PropertyChips hints={form.confidential ? [CREATE_LABELS.confidentialHint] : []}>
              <ToggleChip
                label={CREATE_LABELS.confidential}
                icon={PROJECTS_ICONS.confidential}
                active={form.confidential}
                tooltip={CREATE_LABELS.confidentialHint}
                onToggle={form.toggleConfidential}
              />
            </PropertyChips>
          </div>
        )}
      </Crossfade>
    </FormDialog>
  );
}
