import { errorMessage, useFormState, useResetOnOpen, useSubmitAction } from "../FormDialog";
import { showToast } from "../Toast";
import { PIN_FIELDS } from "./constants";
import { HOST_PIN_LABELS } from "./labels";
import { pinError } from "./pin";

export interface HostPinFormOptions {
  open: boolean;
  onSave(pin: string): Promise<void>;
  onClose(): void;
  toastScope?: string;
}

export function useHostPinForm({ open, onSave, onClose, toastScope }: HostPinFormOptions) {
  const form = useFormState<keyof typeof PIN_FIELDS>(PIN_FIELDS);
  const action = useSubmitAction();
  useResetOnOpen(open, () => {
    form.reset();
    action.reset();
  });

  const submit = async () => {
    const { pin, repeat } = form.values;
    const problem = pinError(pin, repeat);
    if (problem === "pin") return form.fail({ pin: HOST_PIN_LABELS.invalid });
    if (problem === "repeat") return form.fail({ repeat: HOST_PIN_LABELS.mismatch });
    const saved = await action.run(
      () => onSave(pin),
      (error) => HOST_PIN_LABELS.failed.replace("{error}", errorMessage(error)),
    );
    if (!saved) return;
    showToast(HOST_PIN_LABELS.saved, { scope: toastScope });
    onClose();
  };

  return { form, busy: action.busy, error: action.error, submit };
}
