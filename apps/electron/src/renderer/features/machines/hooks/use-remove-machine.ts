import { useCallback } from "react";
import { describeError } from "../../../app/connection";
import { useMachines } from "./use-machines";
import { useMachineToast } from "./use-machine-toast";

export function useRemoveMachine(id: string | null) {
  const { find, remove } = useMachines();
  const toast = useMachineToast();
  const machine = find(id);
  const confirm = useCallback(() => {
    if (!machine?.removable) return;
    remove(machine.id).catch((error: unknown) => toast(describeError(error)));
  }, [machine, remove, toast]);
  return { machine, confirm };
}
