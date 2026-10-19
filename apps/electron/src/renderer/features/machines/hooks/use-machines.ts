import { useCallback, useMemo, useState } from "react";
import type { ConnectionInput } from "../../../../shared/contracts/connection";
import { describeError, useConnectionActions, useConnectionStatus, useSavedMachines, type AddMachineOptions } from "../../../app/connection";
import { MACHINE_LABELS as L } from "../labels";
import { activeMachine, machineRow, type MachineRow } from "../model";
import { openMachineDialog } from "../store";
import { useMachineToast } from "./use-machine-toast";

export interface MachinesApi {
  machines: MachineRow[];
  active: MachineRow | null;
  connecting: boolean;
  refreshing: boolean;
  find(id: string | null): MachineRow | null;
  switchTo(id: string): void;
  add(input: ConnectionInput, options: AddMachineOptions): Promise<MachineRow | null>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  setHostLink(id: string, link: string | null): Promise<void>;
  refreshStatus(quiet?: boolean): void;
  openAdd(): void;
  openRename(id: string): void;
  openHostLink(id: string): void;
  confirmRemove(id: string): void;
}

export function useMachines(): MachinesApi {
  const saved = useSavedMachines();
  const status = useConnectionStatus();
  const actions = useConnectionActions();
  const toast = useMachineToast();
  const [refreshing, setRefreshing] = useState(false);
  const machines = useMemo(() => saved.map(machineRow), [saved]);
  const active = activeMachine(machines);
  const find = useCallback((id: string | null) => machines.find((machine) => machine.id === id) ?? null, [machines]);

  const switchTo = useCallback(
    (id: string) => {
      const target = find(id);
      if (!target || target.active) return;
      actions
        .switchTo(id)
        .then(() => toast(L.switched(target.label)))
        .catch((error: unknown) => toast(describeError(error)));
    },
    [actions, find, toast],
  );

  const add = useCallback(
    async (input: ConnectionInput, options: AddMachineOptions) => {
      const snapshot = await actions.add(input, options);
      const added = snapshot.machines.find((machine) => machine.apiUrl === input.apiUrl);
      return added ? machineRow(added) : null;
    },
    [actions],
  );

  const rename = useCallback(async (id: string, name: string) => {
    await actions.rename(id, name);
  }, [actions]);

  const remove = useCallback(
    async (id: string) => {
      const target = find(id);
      await actions.remove(id);
      if (target) toast(L.removed(target.label));
    },
    [actions, find, toast],
  );

  const setHostLink = useCallback(async (id: string, link: string | null) => {
    await actions.setHostLink(id, link);
  }, [actions]);

  const refreshStatus = useCallback(
    (quiet = false) => {
      setRefreshing(true);
      actions
        .refreshStatus()
        .catch((error: unknown) => {
          if (!quiet) toast(describeError(error));
        })
        .finally(() => setRefreshing(false));
    },
    [actions, toast],
  );

  const connecting = status === "connecting" || status === "discovering";
  return useMemo(
    () => ({
      machines,
      active,
      connecting,
      refreshing,
      find,
      switchTo,
      add,
      rename,
      remove,
      setHostLink,
      refreshStatus,
      openAdd: () => openMachineDialog({ kind: "add" }),
      openRename: (id: string) => openMachineDialog({ kind: "rename", id }),
      openHostLink: (id: string) => openMachineDialog({ kind: "host-link", id }),
      confirmRemove: (id: string) => openMachineDialog({ kind: "remove", id }),
    }),
    [machines, active, connecting, refreshing, find, switchTo, add, rename, remove, setHostLink, refreshStatus],
  );
}
