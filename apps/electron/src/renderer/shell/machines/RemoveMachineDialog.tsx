import { ConfirmDialog } from "../../components/ConfirmDialog";
import { MACHINE_LABELS, useRemoveMachine } from "../../features/machines";

const L = MACHINE_LABELS.removeDialog;

export interface RemoveMachineDialogProps {
  id: string | null;
  onClose(): void;
}

export function RemoveMachineDialog({ id, onClose }: RemoveMachineDialogProps) {
  const { machine, confirm } = useRemoveMachine(id);
  return (
    <ConfirmDialog
      open={id !== null && Boolean(machine?.removable)}
      heading={L.heading(machine?.label ?? "")}
      body={L.body}
      confirmLabel={L.confirm}
      cancelLabel={L.cancel}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}
