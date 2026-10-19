import { isServing } from "../../core/host/model";
import type { MachineHost } from "../../shared/contracts/connection";
import type { HostShellState } from "../../shared/contracts/hostShell";

let current: MachineHost | null = null;
const listeners = new Set<(host: MachineHost | null) => void>();

export function localHost(): MachineHost | null {
  return current;
}

export function publishLocalHost(state: HostShellState): void {
  const next = isServing(state) && state.pairing ? { url: state.pairing.url, name: state.pairing.name || null } : null;
  if (next?.url === current?.url && next?.name === current?.name) return;
  current = next;
  for (const listener of listeners) listener(next);
}

export function onLocalHostChanged(listener: (host: MachineHost | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
