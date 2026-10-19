import type { DefineContract } from "../ipc-types";

export type ConnectionSource = "file" | "env" | "docker";

export interface ConnectionConfig {
  apiUrl: string;
  token: string;
  name: string | null;
  pairingUrl: string | null;
  source: ConnectionSource;
  container?: string;
}

export interface ConnectionInput {
  apiUrl: string;
  token: string;
  name?: string | null;
  pairingUrl?: string | null;
}

export type MachineStatus = "online" | "offline" | "unknown";

export interface MachineHost {
  url: string;
  name: string | null;
}

export interface SavedMachine {
  id: string;
  apiUrl: string;
  name: string | null;
  active: boolean;
  local: boolean;
  status: MachineStatus;
  host: MachineHost | null;
}

export interface AddMachineOptions {
  hostLink?: string | null;
  activate?: boolean;
}

export interface ConnectionSnapshot {
  config: ConnectionConfig | null;
  configFile: string;
  machines: SavedMachine[];
}

export type ProbeOutcome = "ok" | "unreachable";

export type DiscoveryResult =
  | { ok: true; config: ConnectionConfig; message: string; tried: [string, ProbeOutcome][] }
  | { ok: false; error: string };

export type ConnectionContract = DefineContract<{
  methods: {
    load(): ConnectionSnapshot;
    save(input: ConnectionInput): ConnectionSnapshot;
    forget(): ConnectionSnapshot;
    discover(): DiscoveryResult;
    switchTo(id: string): ConnectionSnapshot;
    rename(id: string, name: string): ConnectionSnapshot;
    remove(id: string): ConnectionSnapshot;
    add(input: ConnectionInput, options?: AddMachineOptions): ConnectionSnapshot;
    setHostLink(id: string, link: string | null): ConnectionSnapshot;
    refreshStatus(): ConnectionSnapshot;
  };
  events: {
    changed: ConnectionSnapshot;
  };
}>;
