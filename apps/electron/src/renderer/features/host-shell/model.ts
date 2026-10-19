import type { HostAndroidStatus, HostIosStatus } from "@tesseract/protocol";
import type { HostShellState } from "../../../shared/contracts/hostShell";
import { HOST_GATE_ICONS, HOST_SESSION_MARGIN_MS } from "./constants";
import { HOST_GATE_ACTION_LABELS, HOST_GATE_LABELS } from "./labels";
import type { HostAccess, HostGateAction, HostGateModel } from "./types";

export function sessionLive(state: HostShellState | null, now: number, margin: number = HOST_SESSION_MARGIN_MS): boolean {
  const expiresAt = state?.sessionExpiresAt ?? null;
  return expiresAt !== null && expiresAt - margin > now;
}

export function hostAccess(state: HostShellState | null, now: number): HostAccess {
  if (state === null) return "loading";
  switch (state.status) {
    case "stopped":
    case "stopping":
      return "stopped";
    case "starting":
      return "starting";
    case "failed":
      return "failed";
    default:
      break;
  }
  if (state.pairing === null) return "noHost";
  if (!state.pairing.pinSet) return "noPin";
  return sessionLive(state, now) ? "ready" : "locked";
}

const GATE_ACTIONS: Record<Exclude<HostAccess, "ready">, [HostGateAction | null, HostGateAction | null]> = {
  loading: [null, null],
  stopped: ["start", "preferences"],
  starting: [null, null],
  failed: ["preferences", null],
  noHost: ["preferences", null],
  noPin: ["preferences", null],
  locked: ["unlock", "preferences"],
};

const BUSY: readonly HostAccess[] = ["loading", "starting"];

export function hostGate(access: HostAccess, error: string | null = null): HostGateModel | null {
  if (access === "ready") return null;
  const label = HOST_GATE_LABELS[access];
  const [action, secondary] = GATE_ACTIONS[access];
  return {
    icon: HOST_GATE_ICONS[access],
    title: label.title,
    message: access === "failed" ? error || label.message : label.message,
    loading: BUSY.includes(access),
    action,
    actionLabel: action ? HOST_GATE_ACTION_LABELS[action] : null,
    secondary,
    secondaryLabel: secondary ? HOST_GATE_ACTION_LABELS[secondary] : null,
  };
}

export function sessionRefreshDelay(expiresAt: number | null, now: number, margin: number = HOST_SESSION_MARGIN_MS): number | null {
  if (expiresAt === null) return null;
  const delay = expiresAt - margin - now;
  return delay > 0 ? delay : null;
}

export function emulatorBusy(status: HostAndroidStatus | null): boolean {
  const state = status?.emulator.state;
  return state === "starting" || state === "stopping";
}

export function simulatorBusy(status: HostIosStatus | null): boolean {
  return status?.devices.some((device) => device.state === "booting" || device.state === "shutting_down") ?? false;
}
