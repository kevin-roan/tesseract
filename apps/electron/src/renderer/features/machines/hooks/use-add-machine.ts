import { useCallback, useEffect, useState } from "react";
import { describeError } from "../../../app/connection";
import { MACHINE_LABELS } from "../labels";
import { EMPTY_ADD_MACHINE_FORM, isPairingLink, machineLabel, readAddMachineForm, type AddMachineErrors, type AddMachineForm } from "../model";
import { useMachines } from "./use-machines";
import { useMachineToast } from "./use-machine-toast";

const L = MACHINE_LABELS.addDialog;
const NO_ERRORS: AddMachineErrors = {};

export function useAddMachine(open: boolean, onClose: () => void) {
  const { add } = useMachines();
  const toast = useMachineToast();
  const [form, setForm] = useState<AddMachineForm>(EMPTY_ADD_MACHINE_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<AddMachineErrors>(NO_ERRORS);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_ADD_MACHINE_FORM);
    setBusy(false);
    setError(null);
    setErrors(NO_ERRORS);
  }, [open]);

  const update = useCallback(<K extends keyof AddMachineForm>(key: K, value: AddMachineForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current));
  }, []);

  const submit = useCallback(async () => {
    if (busy) return;
    const request = readAddMachineForm(form);
    if (!request.ok) {
      setErrors(request.errors);
      return;
    }
    setBusy(true);
    setError(null);
    setErrors(NO_ERRORS);
    try {
      const added = await add(request.input, request.options);
      const label = added?.label ?? machineLabel({ apiUrl: request.input.apiUrl, name: request.input.name ?? null });
      toast(request.options.activate ? L.switched(label) : L.added(label));
      onClose();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }, [add, busy, form, onClose, toast]);

  return {
    form,
    errors,
    setAddress: (value: string) => update("address", value),
    setToken: (value: string) => update("token", value),
    setHostLink: (value: string) => update("hostLink", value),
    setName: (value: string) => update("name", value),
    setActivate: (value: boolean) => update("activate", value),
    needsToken: !isPairingLink(form.address),
    busy,
    error,
    submit,
  };
}
