import type { HostIosStatus, SimDevice, SimState } from "@tesseract/protocol";

import type { Tone } from "@/lib/tone";

import { IOS_POLL_INTERVAL_MS } from "./constants";
import { IOS_COPY } from "./content";

const SIM_TONES: Record<SimState, Tone> = {
  unavailable: "neutral",
  shutdown: "neutral",
  booting: "info",
  booted: "success",
  shutting_down: "warning",
  failed: "danger",
};

export const simTone = (state: SimState): Tone => SIM_TONES[state];

export const simStateLabel = (state: SimState): string => IOS_COPY.states[state];

export const isSimTransitioning = (state: SimState): boolean => state === "booting" || state === "shutting_down";

/** A device that holds the Simulator: booting, booted or shutting down. */
export const isSimLive = (state: SimState): boolean => state === "booted" || isSimTransitioning(state);

/** The device that holds the Simulator now, if any. */
export const liveDevice = (status: HostIosStatus | undefined): SimDevice | null =>
  status?.booted ?? status?.devices.find((device) => isSimLive(device.state)) ?? null;

/** Poll fast while a device boots or shuts down. */
export function iosPollInterval(status: HostIosStatus | undefined): number | false {
  if (!status) return false;
  return status.devices.some((device) => isSimTransitioning(device.state)) ? IOS_POLL_INTERVAL_MS : false;
}

/** The picked device, else the live one, else the first device. */
export function pickSimDevice(status: HostIosStatus | undefined, selected: string | null): SimDevice | null {
  const devices = status?.devices ?? [];
  return devices.find((device) => device.udid === selected) ?? liveDevice(status) ?? devices[0] ?? null;
}

/** Only one device runs at a time: boot a shut-down or failed device while no other one holds the Simulator. */
export function canBootSim(status: HostIosStatus, device: SimDevice | null): boolean {
  if (!status.available || !device) return false;
  if (device.state !== "shutdown" && device.state !== "failed") return false;
  const live = liveDevice(status);
  return live === null || live.udid === device.udid;
}

export const canShutdownSim = (device: SimDevice | null): boolean => device !== null && (device.state === "booting" || device.state === "booted");

export const canKillSim = (device: SimDevice | null): boolean => device !== null && isSimLive(device.state);

/** Why `device` cannot boot because another device holds the Simulator, or null. */
export function otherBootedReason(status: HostIosStatus | undefined, device: SimDevice | null): string | null {
  const live = liveDevice(status);
  return live && device && live.udid !== device.udid ? IOS_COPY.otherBooted(live.name) : null;
}

export const simMeta = (device: SimDevice): string =>
  [device.runtime, device.widthPt && device.heightPt ? `${device.widthPt}×${device.heightPt} pt` : null, device.scale ? `@${device.scale}x` : null]
    .filter(Boolean)
    .join(" · ");

export const simOptionMeta = (device: SimDevice): string => [device.runtime, simStateLabel(device.state)].join(" · ");

export type IosUnavailableNotice = { title: string; message: string };

/** Title and message of an unavailable Simulator; the host's own reason wins over the generic one. */
export function iosUnavailableNotice(status: HostIosStatus): IosUnavailableNotice | null {
  if (status.available) return null;
  const copy = status.reasonCode ? IOS_COPY.unavailableReasons[status.reasonCode] : null;
  return { title: copy?.title ?? IOS_COPY.title, message: status.reason ?? copy?.message ?? IOS_COPY.unavailable };
}

/** What an iOS screen streams: the picked device, else the live one. */
export function iosScreenName(status: HostIosStatus | undefined, udid: string | undefined): string | undefined {
  const device = status?.devices.find((item) => item.udid === udid) ?? liveDevice(status);
  return device?.name;
}

/** Folds a device the host just booted or shut down into the status. */
export function withDevice(status: HostIosStatus, device: SimDevice): HostIosStatus {
  const devices = status.devices.map((item) => (item.udid === device.udid ? device : item));
  const booted = isSimLive(device.state) ? device : status.booted?.udid === device.udid ? null : status.booted;
  return { ...status, devices, booted };
}
