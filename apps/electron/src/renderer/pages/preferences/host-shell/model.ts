import type { HostPairing, HostShellState, HostShellStatus } from "../../../../shared/contracts/hostShell";
import { LOG_TAIL_LINES, SERVE_LOCKED_STATUSES, SERVE_ON_STATUSES } from "./constants";
import type { HostTailnetState } from "../../../../shared/contracts/tailnet";
import { HOST_SHELL_LABELS } from "./labels";

const L = HOST_SHELL_LABELS;

export function serveChecked(status: HostShellStatus): boolean {
  return SERVE_ON_STATUSES.includes(status);
}

export function serveLocked(status: HostShellStatus): boolean {
  return SERVE_LOCKED_STATUSES.includes(status);
}

export function serveSubtitle(state: Pick<HostShellState, "status" | "pairing" | "error">): string {
  const label = L.serve.status[state.status];
  const url = state.pairing?.publicUrl ?? state.pairing?.url;
  switch (state.status) {
    case "running":
    case "external":
      return url ? `${label}${L.separator}${url}` : label;
    case "failed":
      return state.error ? L.serve.failed(state.error) : label;
    default:
      return label;
  }
}

export function pinSubtitle(pairing: HostPairing | null): string {
  return pairing?.pinSet ? L.pin.set : L.pin.unset;
}

export function pinButtonLabel(pairing: HostPairing | null): string {
  return pairing?.pinSet ? L.pin.change : L.pin.setPin;
}

export function logText(lines: readonly string[]): string {
  if (lines.length === 0) return L.log.empty;
  return lines.slice(-LOG_TAIL_LINES).join("\n");
}

export function tailnetStatusText(state: HostTailnetState): string {
  const label = L.tailnet.status[state.status];
  if (state.status === "running" && state.shellUrl) return `${label}${L.separator}${state.shellUrl}`;
  if ((state.status === "error" || state.status === "missing" || state.status === "needs_login") && state.error) return `${label}${L.separator}${state.error}`;
  if (state.status === "off" && state.tailscaleDetected && state.mode === "auto") return `${label}${L.separator}${L.tailnet.tailscaleDetected}`;
  return label;
}
