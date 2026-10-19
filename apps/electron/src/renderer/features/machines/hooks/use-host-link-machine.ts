import { useCallback, useEffect, useState } from "react";
import { describeError } from "../../../app/connection";
import { MACHINE_LABELS } from "../labels";
import { isHostLink } from "../model";
import { useMachines } from "./use-machines";
import { useMachineToast } from "./use-machine-toast";

const L = MACHINE_LABELS.hostLinkDialog;

export function useHostLinkMachine(id: string | null, onClose: () => void) {
  const { find, setHostLink } = useMachines();
  const toast = useMachineToast();
  const machine = find(id);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLink("");
    setBusy(false);
    setError(null);
  }, [id]);

  const change = useCallback((value: string) => {
    setLink(value);
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!machine || busy) return;
    const value = link.trim();
    if (!isHostLink(value)) {
      setError(MACHINE_LABELS.addDialog.invalidHostLink);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setHostLink(machine.id, value);
      toast(L.linked(machine.label));
      onClose();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }, [busy, link, machine, onClose, setHostLink, toast]);

  return { machine, link, setLink: change, busy, error, submit, replacing: Boolean(machine?.host) };
}
