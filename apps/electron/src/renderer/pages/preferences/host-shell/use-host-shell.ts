import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { HostShellState } from "../../../../shared/contracts/hostShell";
import { errorMessage } from "../../../components/FormDialog";
import { ipc } from "../../../lib/ipc";
import { usePreferencesToast } from "../shared/use-preferences-toast";
import { HOST_SHELL_STATE_KEY } from "../../../features/host-shell/constants";
import { useHostShellState } from "../../../features/host-shell/hooks/use-host-shell-state";
import { HOST_SHELL_LABELS } from "./labels";

const L = HOST_SHELL_LABELS;

export interface HostShellActions {
  state: HostShellState | null;
  busy: boolean;
  setServe(on: boolean): void;
  setAutostart(enabled: boolean): void;
  refresh(): void;
  savePin(pin: string): Promise<void>;
  rotateToken(): void;
}

export function useHostShell(): HostShellActions {
  const queryClient = useQueryClient();
  const toast = usePreferencesToast();
  const [busy, setBusy] = useState(false);

  const state = useHostShellState({ refetchOnMount: true });

  const run = useCallback(
    async (task: () => Promise<HostShellState>, failure: (error: string) => string) => {
      setBusy(true);
      try {
        queryClient.setQueryData(HOST_SHELL_STATE_KEY, await task());
      } catch (error) {
        toast(failure(errorMessage(error)), true);
      } finally {
        setBusy(false);
      }
    },
    [queryClient, toast],
  );

  const setServe = useCallback(
    (on: boolean) => void run(() => (on ? ipc.hostShell.start() : ipc.hostShell.stop()), on ? L.errors.start : L.errors.stop),
    [run],
  );
  const setAutostart = useCallback((enabled: boolean) => void run(() => ipc.hostShell.setAutostart(enabled), L.errors.autostart), [run]);
  const refresh = useCallback(() => void run(() => ipc.hostShell.refresh(), L.errors.refresh), [run]);

  const savePin = useCallback(
    async (pin: string) => {
      queryClient.setQueryData(HOST_SHELL_STATE_KEY, await ipc.hostShell.setPin(pin));
    },
    [queryClient],
  );

  const rotateToken = useCallback(() => {
    ipc.hostShell
      .rotateToken()
      .then((next) => {
        queryClient.setQueryData(HOST_SHELL_STATE_KEY, next);
        toast(L.rotate.done);
      })
      .catch((error: unknown) => toast(L.rotate.failed(errorMessage(error)), true));
  }, [queryClient, toast]);

  return { state, busy, setServe, setAutostart, refresh, savePin, rotateToken };
}
