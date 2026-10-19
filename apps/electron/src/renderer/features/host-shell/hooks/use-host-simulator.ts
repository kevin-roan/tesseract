import type { HostIosStatus } from "@tesseract/protocol";
import { ipc } from "../../../lib/ipc";
import { HOST_DEVICE_KEYS } from "../constants";
import { simulatorBusy } from "../model";
import { useHostDevice, type HostDevice, type HostDeviceApi, type HostDeviceOptions } from "./use-host-device";

const IOS_API: HostDeviceApi<HostIosStatus> = {
  key: HOST_DEVICE_KEYS.ios,
  status: () => ipc.hostShell.iosStatus(),
  start: (udid) => ipc.hostShell.bootSimulator(udid),
  stop: (signal) => ipc.hostShell.shutdownSimulator(signal),
  link: (url, token) => ipc.hostShell.linkIosSandbox(url, token),
  busy: simulatorBusy,
};

export function useHostSimulator(options?: HostDeviceOptions): HostSimulator {
  return useHostDevice(IOS_API, options);
}

export type HostSimulator = HostDevice<HostIosStatus>;
