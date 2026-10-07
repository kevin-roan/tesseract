import type { HostPairing, HostShellState, HostShellStatus } from "../../../../shared/contracts/hostShell";
import { LOG_TAIL_LINES, SERVE_LOCKED_STATUSES, SERVE_ON_STATUSES } from "./constants";
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
  const url = state.pairing?.url;
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
