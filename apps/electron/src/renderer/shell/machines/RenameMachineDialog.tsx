import { FieldGroup, FormDialog, TitleEntry } from "../../components/FormDialog";
import { MACHINE_DIALOG_WIDTH, MACHINE_ICON, MACHINE_LOCAL_ICON, MACHINE_LABELS, useRenameMachine } from "../../features/machines";

const L = MACHINE_LABELS.renameDialog;

export interface RenameMachineDialogProps {
  id: string | null;
  onClose(): void;
}

export function RenameMachineDialog({ id, onClose }: RenameMachineDialogProps) {
  const form = useRenameMachine(id, onClose);
  const machine = form.machine;
  return (
    <FormDialog
      open={id !== null && machine !== null}
      title={L.title}
      subtitle={machine ? L.subtitle(machine.apiUrl) : null}
      context={machine ? { label: machine.label, icon: machine.local ? MACHINE_LOCAL_ICON : MACHINE_ICON } : null}
      width={MACHINE_DIALOG_WIDTH}
      submitLabel={L.save}
      cancelLabel={L.cancel}
      onSubmit={() => void form.submit()}
      onClose={onClose}
      error={form.error}
      busy={form.busy}
    >
      <FieldGroup description={L.hint}>
        <TitleEntry autoFocus placeholder={L.name} aria-label={L.name} value={form.name} onChange={(event) => form.setName(event.target.value)} />
      </FieldGroup>
    </FormDialog>
  );
}
