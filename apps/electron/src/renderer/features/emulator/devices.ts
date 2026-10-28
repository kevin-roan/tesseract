import type { AndroidLinkInfo } from "@tesseract/protocol";
import { useMemo } from "react";
import type { HostDevice } from "../host-shell/hooks/use-host-device";
import { useHostEmulator } from "../host-shell/hooks/use-host-emulator";
import { useHostSimulator } from "../host-shell/hooks/use-host-simulator";
import { ANDROID_SCREEN, IOS_SCREEN } from "./constants";
import { ANDROID_LABELS, DEVICE_KIND_LABELS, IOS_LABELS } from "./labels";
import { androidSnapshot, iosSnapshot } from "./model";
import type { DeviceControls, DeviceKind, DeviceKindId, DeviceSnapshot, StreamApi } from "./types";

function useControls<Status extends { link: AndroidLinkInfo }>(host: HostDevice<Status>, toSnapshot: (status: Status) => DeviceSnapshot): DeviceControls {
  const { status } = host;
  const snapshot = useMemo(() => (status ? toSnapshot(status) : null), [status, toSnapshot]);
  return {
    access: host.access,
    snapshot,
    loading: host.loading,
    error: host.error,
    starting: host.starting,
    stopping: host.stopping,
    linking: host.linking,
    refresh: host.refresh,
    start: host.start,
    stop: host.stop,
    kill: host.kill,
    link: host.link,
  };
}

const useAndroidControls = () => useControls(useHostEmulator(), androidSnapshot);
const useIosControls = () => useControls(useHostSimulator(), iosSnapshot);

const ANDROID_STREAM: StreamApi = {
  get: (client) => client.androidStreamSettings(),
  update: (client, body) => client.updateAndroidStream(body),
};

const IOS_STREAM: StreamApi = {
  get: (client) => client.iosStreamSettings(),
  update: (client, body) => client.updateIosStream(body),
};

export const ANDROID_DEVICE: DeviceKind = {
  id: "android",
  label: DEVICE_KIND_LABELS.android,
  icon: "smartphone",
  screen: ANDROID_SCREEN,
  labels: ANDROID_LABELS,
  stream: ANDROID_STREAM,
  useControls: useAndroidControls,
};

export const IOS_DEVICE: DeviceKind = {
  id: "ios",
  label: DEVICE_KIND_LABELS.ios,
  icon: "smartphone",
  screen: IOS_SCREEN,
  labels: IOS_LABELS,
  stream: IOS_STREAM,
  useControls: useIosControls,
};

export const DEVICE_KINDS: readonly DeviceKind[] = [ANDROID_DEVICE, IOS_DEVICE];

export function deviceKind(id: DeviceKindId | null | undefined): DeviceKind {
  return DEVICE_KINDS.find((kind) => kind.id === id) ?? ANDROID_DEVICE;
}
