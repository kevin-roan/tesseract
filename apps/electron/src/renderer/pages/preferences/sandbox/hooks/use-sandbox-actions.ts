import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { SandboxComponent, SetupChoices } from "../../../../../shared/contracts/sandbox";
import { useSettings, useUpdateSettings } from "../../../../app/settings";
import { errorMessage } from "../../../../components/FormDialog";
import { ipc } from "../../../../lib/ipc";
import { usePreferencesToast } from "../../shared/use-preferences-toast";
import { SANDBOX_SETTINGS_KEYS as KEYS } from "../constants";
import { SANDBOX_SETTINGS_LABELS } from "../labels";

const L = SANDBOX_SETTINGS_LABELS;

export type PendingAction = "start" | "stop" | "rebuild" | "cancel" | null;

export function useSandboxActions(defaults: SetupChoices | null, clearLog: () => void) {
  const queryClient = useQueryClient();
  const toast = usePreferencesToast();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const [pending, setPending] = useState<PendingAction>(null);

  const guarded = useCallback(
    async (action: Exclude<PendingAction, null>, task: () => Promise<void>, failure: (error: string) => string) => {
      setPending(action);
      try {
        await task();
      } catch (error) {
        toast(failure(errorMessage(error)), true);
      } finally {
        setPending(null);
      }
    },
    [toast],
  );

  const start = useCallback(
    () =>
      void guarded(
        "start",
        async () => {
          queryClient.setQueryData(KEYS.status, await ipc.sandbox.up());
          toast(L.stack.started);
        },
        L.stack.startFailed,
      ),
    [guarded, queryClient, toast],
  );

  const stop = useCallback(
    () =>
      void guarded(
        "stop",
        async () => {
          queryClient.setQueryData(KEYS.status, await ipc.sandbox.down(false));
          toast(L.stack.stopped);
        },
        L.stack.stopFailed,
      ),
    [guarded, queryClient, toast],
  );

  const rebuild = useCallback(
    (components: readonly SandboxComponent[]) =>
      void guarded(
        "rebuild",
        async () => {
          if (!defaults) return;
          clearLog();
          queryClient.setQueryData(KEYS.stack, await ipc.sandbox.save({ ...defaults, components: [...components] }));
          queryClient.setQueryData(KEYS.phase, await ipc.sandbox.build("build"));
          toast(L.rebuild.started);
        },
        L.rebuild.failed,
      ),
    [clearLog, defaults, guarded, queryClient, toast],
  );

  const cancel = useCallback(
    () =>
      void guarded(
        "cancel",
        async () => {
          queryClient.setQueryData(KEYS.phase, await ipc.sandbox.cancel());
        },
        L.build.cancelFailed,
      ),
    [guarded, queryClient],
  );

  const setAutostart = useCallback(
    (enabled: boolean) =>
      updateSettings.mutate({ sandboxAutostart: enabled }, { onError: (error) => toast(L.stack.autostartFailed(errorMessage(error)), true) }),
    [toast, updateSettings],
  );

  return { pending, start, stop, rebuild, cancel, autostart: settings.sandboxAutostart, setAutostart };
}
