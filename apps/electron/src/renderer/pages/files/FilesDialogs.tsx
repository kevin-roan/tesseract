import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { FileActions } from "../../features/files/hooks/use-file-actions";
import { DELETE_LABELS, formatLabel, TAILDROP_LABELS } from "../../features/files/labels";

export interface FilesDialogsProps {
  actions: FileActions;
}

export function FilesDialogs({ actions }: FilesDialogsProps) {
  const { dialog, dialogOpen, closeDialog, clearDialog } = actions;
  if (!dialog) return null;
  const name = dialog.artifact.fileName;
  if (dialog.kind === "delete") {
    return (
      <ConfirmDialog
        open={dialogOpen}
        heading={formatLabel(DELETE_LABELS.title, { name })}
        body={DELETE_LABELS.body}
        confirmLabel={DELETE_LABELS.confirm}
        cancelLabel={DELETE_LABELS.cancel}
        onConfirm={() => actions.confirmDelete(dialog.artifact)}
        onClose={closeDialog}
        onExitComplete={clearDialog}
      />
    );
  }
  return (
    <ConfirmDialog
      open={dialogOpen}
      heading={formatLabel(TAILDROP_LABELS.title, { name })}
      body={TAILDROP_LABELS.body}
      confirmLabel={TAILDROP_LABELS.confirm}
      cancelLabel={TAILDROP_LABELS.cancel}
      destructive={false}
      options={dialog.options}
      chooseLabel={TAILDROP_LABELS.target}
      onConfirm={(choice) => actions.confirmSend(dialog.artifact, choice, dialog.options)}
      onClose={closeDialog}
      onExitComplete={clearDialog}
    />
  );
}
