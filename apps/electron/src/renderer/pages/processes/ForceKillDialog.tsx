import { useRef } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PROCESSES_LABELS as L } from "../../features/processes/labels";
import type { ProcessTarget } from "../../features/processes/types";

export interface ForceKillDialogProps {
  target: ProcessTarget | null;
  onConfirm(target: ProcessTarget): void;
  onClose(): void;
}

export function ForceKillDialog({ target, onConfirm, onClose }: ForceKillDialogProps) {
  const last = useRef(target);
  if (target) last.current = target;
  const shown = target ?? last.current;
  if (!shown) return null;
  return (
    <ConfirmDialog
      open={target !== null}
      heading={L.confirm.heading}
      body={shown.supervised ? L.confirm.supervisedBody(shown.name) : L.confirm.body(shown.name)}
      confirmLabel={L.confirm.confirm}
      cancelLabel={L.confirm.cancel}
      destructive
      onConfirm={() => onConfirm(shown)}
      onClose={onClose}
    />
  );
}
