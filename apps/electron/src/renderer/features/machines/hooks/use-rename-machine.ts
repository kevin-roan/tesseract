import { useCallback, useEffect, useState } from "react";
import { describeError, useSavedMachines } from "../../../app/connection";
import { MACHINE_LABELS } from "../labels";
import { useMachines } from "./use-machines";
import { useMachineToast } from "./use-machine-toast";

const L = MACHINE_LABELS.renameDialog;

export function useRenameMachine(id: string | null, onClose: () => void) {
  const { find, rename } = useMachines();
  const toast = useMachineToast();
  const machine = find(id);
  const current = useSavedMachines().find((item) => item.id === id)?.name ?? "";
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setName(current);
    setBusy(false);
    setError(null);
  }, [id, current]);

  const submit = useCallback(async () => {
    if (!machine || busy) return;
    const value = name.trim();
    if (value === current) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await rename(machine.id, value);
      toast(value ? L.renamed(value) : L.reset);
      onClose();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }, [busy, current, machine, name, onClose, rename, toast]);

  return { machine, name, setName, busy, error, submit };
}
