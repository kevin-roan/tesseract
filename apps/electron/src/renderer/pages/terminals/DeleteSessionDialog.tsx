import { useRef } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { CONFIRM_LABELS } from "../../features/terminals/labels";

export interface DeleteSessionDialogProps {
  target: { id: string; title: string } | null;
  onConfirm(id: string): void;
  onClose(): void;
}

export function DeleteSessionDialog({ target, onConfirm, onClose }: DeleteSessionDialogProps) {
  const last = useRef(target);
  if (target) last.current = target;
  const shown = target ?? last.current;
  if (!shown) return null;
  return (
    <ConfirmDialog
      open={target !== null}
      heading={CONFIRM_LABELS.heading}
      body={CONFIRM_LABELS.body(shown.title)}
      confirmLabel={CONFIRM_LABELS.confirm}
      cancelLabel={CONFIRM_LABELS.cancel}
      destructive
      onConfirm={() => {
        onClose();
        onConfirm(shown.id);
      }}
      onClose={onClose}
    />
  );
}
