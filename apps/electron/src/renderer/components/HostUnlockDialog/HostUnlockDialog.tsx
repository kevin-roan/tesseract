import type { DialogPresentation } from "../DialogShell";
import { FieldGroup, FormDialog, FormEntry, FormField } from "../FormDialog";
import { HOST_UNLOCK_WIDTH } from "./constants";
import { HOST_UNLOCK_LABELS } from "./labels";
import { useHostUnlockForm } from "./use-host-unlock-form";

export interface HostUnlockDialogProps {
  onUnlock(pin: string): Promise<void>;
  onClose(): void;
  onUnlocked?: () => void;
  open?: boolean;
  presentation?: DialogPresentation;
  onExitComplete?: () => void;
}

export function HostUnlockDialog({ onUnlock, onClose, onUnlocked, open = true, presentation, onExitComplete }: HostUnlockDialogProps) {
  const { form, busy, error, submit } = useHostUnlockForm({ open, onUnlock, onClose, onUnlocked });
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      presentation={presentation}
      onExitComplete={onExitComplete}
      title={HOST_UNLOCK_LABELS.title}
      context={{ label: HOST_UNLOCK_LABELS.context, icon: "host" }}
      width={HOST_UNLOCK_WIDTH}
      subtitle={HOST_UNLOCK_LABELS.subtitle}
      submitLabel={HOST_UNLOCK_LABELS.unlock}
      cancelLabel={HOST_UNLOCK_LABELS.cancel}
      onSubmit={() => void submit()}
      busy={busy}
      error={error}
    >
      <FieldGroup errors={form.errorsFor("pin")}>
        <FormField label={HOST_UNLOCK_LABELS.pin}>
          <FormEntry password inputMode="numeric" {...form.field("pin")} />
        </FormField>
      </FieldGroup>
    </FormDialog>
  );
}
