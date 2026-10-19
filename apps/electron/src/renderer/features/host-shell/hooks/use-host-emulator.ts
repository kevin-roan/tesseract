import type { HostAndroidStatus } from "@tesseract/protocol";
import { ipc } from "../../../lib/ipc";
import { HOST_DEVICE_KEYS } from "../constants";
import { emulatorBusy } from "../model";
import { useHostDevice, type HostDevice, type HostDeviceApi, type HostDeviceOptions } from "./use-host-device";

const ANDROID_API: HostDeviceApi<HostAndroidStatus> = {
  key: HOST_DEVICE_KEYS.android,
  status: () => ipc.hostShell.androidStatus(),
  start: (avd) => ipc.hostShell.startEmulator(avd),
  stop: (signal) => ipc.hostShell.stopEmulator(signal),
  link: (url, token) => ipc.hostShell.linkSandbox(url, token),
  busy: emulatorBusy,
};

export function useHostEmulator(options?: HostDeviceOptions): HostEmulator {
  return useHostDevice(ANDROID_API, options);
}

export type HostEmulator = HostDevice<HostAndroidStatus>;
