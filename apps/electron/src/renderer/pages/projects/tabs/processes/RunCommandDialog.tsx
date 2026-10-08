import type { TesseractClient } from "@tesseract/client";
import type { ProcessInfo, Project } from "@tesseract/protocol";
import { Chip } from "../../../../components/Chip";
import { FieldGroup, FormDialog, FormEntry, FormField, PropertyChips, TitleEntry } from "../../../../components/FormDialog";
import { RUN_DIALOG_WIDTH } from "../../../../features/projects/constants";
import { RUN_LABELS as L } from "../../../../features/projects/labels";
import { RUN_DIALOG_ICON } from "./constants";
import { useRunCommand } from "./hooks/use-run-command";

export interface RunCommandDialogProps {
  project: Project;
  client: TesseractClient | null;
  open: boolean;
  onStarted(process: ProcessInfo): void;
  onClose(): void;
}

export function RunCommandDialog({ project, client, open, onStarted, onClose }: RunCommandDialogProps) {
  const form = useRunCommand({ project, client, open, onStarted, onClose });
  return (
    <FormDialog
      open={open}
      width={RUN_DIALOG_WIDTH}
      title={L.title}
      context={{ label: project.name || project.id, icon: RUN_DIALOG_ICON }}
      submitLabel={L.run}
      cancelLabel={L.cancel}
      onSubmit={form.onSubmit}
      onClose={onClose}
      error={form.error}
      busy={form.busy}
    >
      <FieldGroup description={L.location(project.path)} errors={form.commandErrors}>
        <TitleEntry monospace autoFocus placeholder={L.command} aria-label={L.command} disabled={form.busy} {...form.command} />
      </FieldGroup>
      <FieldGroup errors={form.detailErrors}>
        <FormField label={L.name}>
          <FormEntry disabled={form.busy} {...form.name} />
        </FormField>
        <FormField label={L.port}>
          <FormEntry inputMode="numeric" disabled={form.busy} {...form.port} />
        </FormField>
      </FieldGroup>
      <PropertyChips hints={form.display ? [L.displayHint] : []}>
        <Chip
          kind="switch"
          size="property"
          icon="display"
          label={L.display}
          selected={form.display}
          disabled={form.busy}
          onClick={form.toggleDisplay}
        />
      </PropertyChips>
    </FormDialog>
  );
}
