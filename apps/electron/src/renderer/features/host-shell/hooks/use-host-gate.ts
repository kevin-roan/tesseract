import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { usePreferencesRoute } from "../../../app/navigation";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { HOST_SHELL_SECTION, HOST_SHELL_STATE_KEY } from "../constants";
import { HOST_ERROR_LABELS } from "../labels";
import { hostGate } from "../model";
import type { HostGateAction } from "../types";
import { useHostAccess } from "./use-host-access";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useHostGate() {
  const host = useHostAccess({ refetchOnMount: true });
  const queryClient = useQueryClient();
  const { openPreferences } = usePreferencesRoute();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const gate = hostGate(host.access, host.state?.error ?? null);

  const run = useCallback(
    (action: HostGateAction | null) => {
      if (action === "unlock") setUnlockOpen(true);
      else if (action === "preferences") openPreferences(HOST_SHELL_SECTION);
      else if (action === "start") {
        ipc.hostShell
          .start()
          .then((state) => queryClient.setQueryData(HOST_SHELL_STATE_KEY, state))
          .catch((error: unknown) => showToast(HOST_ERROR_LABELS.start(message(error))));
      }
    },
    [openPreferences, queryClient],
  );

  const unlock = useCallback(
    async (pin: string) => {
      queryClient.setQueryData(HOST_SHELL_STATE_KEY, await ipc.hostShell.unlock(pin));
    },
    [queryClient],
  );

  const lock = useCallback(() => {
    ipc.hostShell
      .lock()
      .then((state) => queryClient.setQueryData(HOST_SHELL_STATE_KEY, state))
      .catch((error: unknown) => showToast(HOST_ERROR_LABELS.lock(message(error))));
  }, [queryClient]);

  return {
    ...host,
    gate,
    onAction: useCallback(() => run(gate?.action ?? null), [run, gate?.action]),
    onSecondary: useCallback(() => run(gate?.secondary ?? null), [run, gate?.secondary]),
    lock,
    unlockDialog: { open: unlockOpen, close: useCallback(() => setUnlockOpen(false), []), unlock },
  };
}

export type HostGateState = ReturnType<typeof useHostGate>;
