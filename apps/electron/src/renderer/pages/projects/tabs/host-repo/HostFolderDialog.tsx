import { useState } from "react";
import { errorMessage, FieldGroup, FormDialog, FormEntry, FormField, useResetOnOpen, useSubmitAction } from "../../../../components/FormDialog";
import { HOST_FOLDER_DIALOG_WIDTH } from "./constants";
import { HOST_REPO_LABELS as L } from "./labels";

export interface HostFolderDialogProps {
  open: boolean;
  machine: string;
  projectName: string;
  folder: string;
  onSave(path: string): Promise<void>;
  onClose(): void;
}

export function HostFolderDialog({ open, machine, projectName, folder, onSave, onClose }: HostFolderDialogProps) {
  const [value, setValue] = useState(folder);
  const action = useSubmitAction();
  useResetOnOpen(open, () => {
    setValue(folder);
    action.reset();
  });
  const submit = async () => {
    if (await action.run(() => onSave(value), errorMessage)) onClose();
  };
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={L.folderDialogTitle}
      context={{ label: machine, icon: "host" }}
      width={HOST_FOLDER_DIALOG_WIDTH}
      subtitle={L.folderDialogSubtitle(machine, projectName)}
      submitLabel={L.folderSave}
      cancelLabel={L.folderCancel}
      onSubmit={() => void submit()}
      busy={action.busy}
      error={action.error}
    >
      <FieldGroup>
        <FormField label={L.folderField}>
          <FormEntry value={value} placeholder={L.folderPlaceholder} spellCheck={false} onChange={(event) => setValue(event.target.value)} />
        </FormField>
      </FieldGroup>
    </FormDialog>
  );
}
