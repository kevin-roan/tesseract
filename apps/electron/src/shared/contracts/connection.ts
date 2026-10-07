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

export interface ConnectionSnapshot {
  config: ConnectionConfig | null;
  configFile: string;
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
  };
  events: {
    changed: ConnectionSnapshot;
  };
}>;
