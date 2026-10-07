import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { AvdInfo, EmulatorState } from "../../../../../shared/contracts/android";
import { errorMessage } from "../../../../components/FormDialog";
import { ipc } from "../../../../lib/ipc";
import { QUERY_KEYS } from "../../../../onboarding/android/constants";
import { usePreferencesToast } from "../../shared/use-preferences-toast";
import { ANDROID_SETTINGS_KEYS as KEYS } from "../constants";
import { ANDROID_SETTINGS_LABELS } from "../labels";

const L = ANDROID_SETTINGS_LABELS.devices;

export function useDeviceActions(sdkRoot: string | null) {
  const client = useQueryClient();
  const toast = usePreferencesToast();
  const [deleting, setDeleting] = useState<AvdInfo | null>(null);

  const store = useCallback((state: EmulatorState) => client.setQueryData(KEYS.emulator, state), [client]);

  const start = useCallback(
    (avd: AvdInfo) => {
      if (!sdkRoot) return;
      store({ kind: "starting", avd: avd.name, since: Date.now() });
      ipc.android
        .startEmulator(sdkRoot, avd.name)
        .then(store)
        .catch((error: unknown) => {
          store({ kind: "stopped" });
          toast(L.startFailed(errorMessage(error)), true);
        });
    },
    [sdkRoot, store, toast],
  );

  const stop = useCallback(() => {
    ipc.android
      .stopEmulator()
      .then(store)
      .catch((error: unknown) => toast(L.stopFailed(errorMessage(error)), true));
  }, [store, toast]);

  const remove = useCallback(
    (avd: AvdInfo) => {
      if (!sdkRoot) return;
      ipc.android
        .deleteAvd(sdkRoot, avd.name)
        .then(() => {
          toast(L.deleted(avd.name));
          return client.invalidateQueries({ queryKey: QUERY_KEYS.avds(sdkRoot) });
        })
        .catch((error: unknown) => toast(L.deleteFailed(errorMessage(error)), true));
    },
    [client, sdkRoot, toast],
  );

  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: KEYS.emulator });
    if (sdkRoot) void client.invalidateQueries({ queryKey: QUERY_KEYS.avds(sdkRoot) });
  }, [client, sdkRoot]);

  return {
    refresh,
    start,
    stop,
    deleting,
    askDelete: setDeleting,
    closeDelete: () => setDeleting(null),
    confirmDelete: () => {
      if (deleting) remove(deleting);
    },
  };
}
