import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { REMOVE_LABELS } from "../../../features/projects/labels";
import type { RemovalPrompt } from "../../../features/projects/types";

export interface RemoveProjectDialogProps {
  prompt: RemovalPrompt | null;
  open: boolean;
  onConfirm(): void;
  onClose(): void;
}

export function RemoveProjectDialog({ prompt, open, onConfirm, onClose }: RemoveProjectDialogProps) {
  return (
    <ConfirmDialog
      open={open && prompt !== null}
      heading={prompt?.heading ?? ""}
      body={prompt?.body}
      confirmLabel={prompt?.confirm ?? REMOVE_LABELS.delete}
      cancelLabel={REMOVE_LABELS.cancel}
      destructive
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
