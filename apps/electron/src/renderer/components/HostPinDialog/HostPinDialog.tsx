import type { DialogPresentation } from "../DialogShell";
import { FieldGroup, FormDialog, FormEntry, FormField } from "../FormDialog";
import { HOST_PIN_WIDTH } from "./constants";
import { HOST_PIN_LABELS } from "./labels";
import { useHostPinForm } from "./use-host-pin-form";

export interface HostPinDialogProps {
  onSave(pin: string): Promise<void>;
  onClose(): void;
  open?: boolean;
  toastScope?: string;
  presentation?: DialogPresentation;
  onExitComplete?: () => void;
}

export function HostPinDialog({ onSave, onClose, open = true, toastScope, presentation, onExitComplete }: HostPinDialogProps) {
  const { form, busy, error, submit } = useHostPinForm({ open, onSave, onClose, toastScope });
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      presentation={presentation}
      onExitComplete={onExitComplete}
      title={HOST_PIN_LABELS.title}
      context={{ label: HOST_PIN_LABELS.context, icon: "host" }}
      width={HOST_PIN_WIDTH}
      subtitle={HOST_PIN_LABELS.subtitle}
      submitLabel={HOST_PIN_LABELS.save}
      cancelLabel={HOST_PIN_LABELS.cancel}
      onSubmit={() => void submit()}
      busy={busy}
      error={error}
    >
      <FieldGroup description={HOST_PIN_LABELS.description} errors={form.errorsFor("pin", "repeat")}>
        <FormField label={HOST_PIN_LABELS.pin}>
          <FormEntry password inputMode="numeric" {...form.field("pin")} />
        </FormField>
        <FormField label={HOST_PIN_LABELS.repeat}>
          <FormEntry password inputMode="numeric" {...form.field("repeat")} />
        </FormField>
      </FieldGroup>
    </FormDialog>
  );
}
