import type { AndroidLinkInfo, HostAndroidStatus, HostIosStatus, SimDevice } from "@tesseract/protocol";
import { EMULATOR_TONES, SCREEN_STATUS_TONES, SIM_EMULATOR_STATES } from "./constants";
import { EMULATOR_STATE_LABELS, IOS_UNAVAILABLE_LABELS, LINK_LABELS, OVERLAY_LABELS, SCREEN_STATUS_LABELS } from "./labels";
import type { BadgeModel, DeviceLabels, DeviceSnapshot, OverlayModel, ScreenState } from "./types";

export function androidSnapshot(status: HostAndroidStatus): DeviceSnapshot {
  const { emulator } = status;
  return {
    available: status.available && emulator.state !== "unavailable",
    reason: status.reason,
    state: emulator.state,
    target: emulator.avd,
    targets: status.avds.map((avd) => ({ id: avd, label: avd })),
    device: emulator.serial,
    size: emulator.width && emulator.height ? { width: emulator.width, height: emulator.height } : null,
    error: emulator.error,
    link: status.link,
  };
}

const simLabel = (device: SimDevice) => `${device.name} · ${device.runtime}`;

function activeSimulator(status: HostIosStatus): SimDevice | null {
  return status.booted ?? status.devices.find((device) => SIM_EMULATOR_STATES[device.state] !== "stopped" && device.state !== "unavailable") ?? null;
}

export function iosSnapshot(status: HostIosStatus): DeviceSnapshot {
  const active = activeSimulator(status);
  const state = status.available ? (active ? SIM_EMULATOR_STATES[active.state] : "stopped") : "unavailable";
  const size = active?.widthPt && active.heightPt && active.scale ? { width: Math.round(active.widthPt * active.scale), height: Math.round(active.heightPt * active.scale) } : null;
  return {
    available: status.available,
    reason: status.reasonCode ? IOS_UNAVAILABLE_LABELS[status.reasonCode] : status.reason,
    state,
    target: active?.udid ?? null,
    targets: status.devices.filter((device) => device.state !== "unavailable").map((device) => ({ id: device.udid, label: simLabel(device) })),
    device: active?.state === "booted" ? active.udid : null,
    size,
    error: active?.error ?? null,
    link: status.link,
  };
}

export function pickTarget(snapshot: DeviceSnapshot | null, selected: string | null): string | null {
  if (!snapshot) return null;
  const ids = snapshot.targets.map((target) => target.id);
  if (selected && ids.includes(selected)) return selected;
  if (snapshot.target && ids.includes(snapshot.target)) return snapshot.target;
  return ids[0] ?? null;
}

export function isActive(snapshot: DeviceSnapshot | null): boolean {
  return snapshot?.state === "starting" || snapshot?.state === "running";
}

export function canStart(snapshot: DeviceSnapshot | null, target: string | null): boolean {
  return snapshot !== null && snapshot.available && target !== null && !isActive(snapshot) && snapshot.state !== "stopping";
}

export function canStop(snapshot: DeviceSnapshot | null): boolean {
  return isActive(snapshot) || snapshot?.state === "stopping";
}

export function screenLive(snapshot: DeviceSnapshot | null): boolean {
  return snapshot?.state === "running" && snapshot.device !== null;
}

export function deviceBadge(snapshot: DeviceSnapshot | null): BadgeModel | null {
  return snapshot ? { label: EMULATOR_STATE_LABELS[snapshot.state], tone: EMULATOR_TONES[snapshot.state] } : null;
}

export function screenBadge(screen: ScreenState): BadgeModel {
  return { label: SCREEN_STATUS_LABELS[screen.status], tone: SCREEN_STATUS_TONES[screen.status] };
}

const trimUrl = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();

export function isLinkedTo(link: AndroidLinkInfo | null, sandboxUrl: string | null): boolean {
  return Boolean(link?.configured && link.sandboxUrl && sandboxUrl && trimUrl(link.sandboxUrl) === trimUrl(sandboxUrl));
}

export function linkBadge(link: AndroidLinkInfo | null, sandboxUrl: string | null): BadgeModel {
  if (!link?.configured) return { label: LINK_LABELS.notLinked, tone: "neutral" };
  if (sandboxUrl && !isLinkedTo(link, sandboxUrl)) return { label: LINK_LABELS.otherSandbox, tone: "warning" };
  return link.connected ? { label: LINK_LABELS.connected, tone: "success" } : { label: LINK_LABELS.disconnected, tone: "warning" };
}

export function screenOverlay(snapshot: DeviceSnapshot | null, screen: ScreenState, labels: DeviceLabels): OverlayModel | null {
  if (!snapshot) return null;
  const { overlay } = labels;
  if (!snapshot.available) return { title: overlay.unavailable.title, message: snapshot.reason ?? labels.unavailable, spinner: false, actionLabel: null };
  switch (snapshot.state) {
    case "stopped":
    case "unavailable":
      return { ...overlay.stopped, spinner: false, actionLabel: null };
    case "starting":
      return { ...overlay.starting, spinner: true, actionLabel: null };
    case "stopping":
      return { ...overlay.stopping, spinner: true, actionLabel: null };
    case "failed":
      return { title: overlay.failed.title, message: snapshot.error, spinner: false, actionLabel: null };
    default:
      break;
  }
  switch (screen.status) {
    case "connected":
      return null;
    case "idle":
    case "connecting":
      return { ...OVERLAY_LABELS.connecting, spinner: true, actionLabel: null };
    case "disconnected":
      return { title: OVERLAY_LABELS.disconnected.title, message: screen.error, spinner: false, actionLabel: OVERLAY_LABELS.reconnect };
    case "error":
      return { title: OVERLAY_LABELS.error.title, message: screen.error, spinner: false, actionLabel: OVERLAY_LABELS.reconnect };
  }
}
