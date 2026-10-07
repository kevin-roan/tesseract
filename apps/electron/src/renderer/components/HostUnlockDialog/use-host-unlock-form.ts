import { errorMessage, useFormState, useResetOnOpen, useSubmitAction } from "../FormDialog";
import { isValidPin } from "../HostPinDialog";
import { UNLOCK_FIELDS } from "./constants";
import { HOST_UNLOCK_LABELS } from "./labels";

export interface HostUnlockFormOptions {
  open: boolean;
  onUnlock(pin: string): Promise<void>;
  onClose(): void;
  onUnlocked?: () => void;
}

export function useHostUnlockForm({ open, onUnlock, onClose, onUnlocked }: HostUnlockFormOptions) {
  const form = useFormState<keyof typeof UNLOCK_FIELDS>(UNLOCK_FIELDS);
  const action = useSubmitAction();
  useResetOnOpen(open, () => {
    form.reset();
    action.reset();
  });

  const submit = async () => {
    const { pin } = form.values;
    if (!isValidPin(pin)) return form.fail({ pin: HOST_UNLOCK_LABELS.invalid });
    const unlocked = await action.run(() => onUnlock(pin), errorMessage);
    if (!unlocked) return;
    onClose();
    onUnlocked?.();
  };

  return { form, busy: action.busy, error: action.error, submit };
}
