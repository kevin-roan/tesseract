import { FieldGroup, FormDialog, FormEntry, FormField } from "../../components/FormDialog";
import { MACHINE_DIALOG_WIDTH, MACHINE_HOST_ICON, MACHINE_LABELS, useHostLinkMachine } from "../../features/machines";

const L = MACHINE_LABELS.hostLinkDialog;

export interface HostLinkDialogProps {
  id: string | null;
  onClose(): void;
}

export function HostLinkDialog({ id, onClose }: HostLinkDialogProps) {
  const form = useHostLinkMachine(id, onClose);
  const machine = form.machine;
  return (
    <FormDialog
      open={id !== null && machine !== null}
      title={form.replacing ? L.replaceTitle : L.title}
      subtitle={machine ? L.subtitle(machine.label) : null}
      context={machine ? { label: machine.label, icon: MACHINE_HOST_ICON } : null}
      width={MACHINE_DIALOG_WIDTH}
      submitLabel={L.save}
      cancelLabel={L.cancel}
      onSubmit={() => void form.submit()}
      onClose={onClose}
      busy={form.busy}
    >
      <FieldGroup errors={[form.error]}>
        <FormField label={L.link}>
          <FormEntry
            autoFocus
            monospace
            spellCheck={false}
            placeholder={L.placeholder}
            disabled={form.busy}
            error={Boolean(form.error)}
            value={form.link}
            onChange={(event) => form.setLink(event.target.value)}
          />
        </FormField>
      </FieldGroup>
    </FormDialog>
  );
}
