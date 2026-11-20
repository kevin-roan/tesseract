import { useCallback, useMemo } from "react";
import { useApiQuery } from "../../../app/data";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { useHostEmulator } from "../../host-shell/hooks/use-host-emulator";
import { useHostSimulator } from "../../host-shell/hooks/use-host-simulator";
import { PROJECT_DEVICES_KEY, PROJECT_DEVICES_REFRESH_MS } from "../constants";
import { DEVICE_KINDS } from "../devices";
import { DEVICE_WINDOW_LABELS } from "../labels";
import { liveDeviceKinds } from "../model";
import type { DeviceKind } from "../types";

export function useProjectDevices(projectId: string) {
  const android = useHostEmulator().status;
  const ios = useHostSimulator().status;
  const runs = useApiQuery([PROJECT_DEVICES_KEY, projectId], (client, signal) => client.listAppRuns({ projectId }, { signal }), {
    refetchInterval: PROJECT_DEVICES_REFRESH_MS,
    retry: false,
  }).data;
  const live = liveDeviceKinds(runs, { android: android?.emulator.state === "running", ios: Boolean(ios?.booted) });
  const key = live.join();
  const kinds = useMemo(() => DEVICE_KINDS.filter((kind) => key.includes(kind.id)), [key]);
  const open = useCallback((kind: DeviceKind) => {
    ipc.window.openDevice(kind.id).catch((error: unknown) => showToast(DEVICE_WINDOW_LABELS.openFailed(error instanceof Error ? error.message : String(error))));
  }, []);
  return { kinds, open };
}
