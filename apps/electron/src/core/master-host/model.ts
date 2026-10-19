import { buildPairingLink, HOST_PAIRING_ACTION, parsePairingLink } from "@tesseract/protocol";
import type { ConnectionConfig, MachineHost, SavedMachine } from "../../shared/contracts/connection";
import type { MasterHostState } from "../../shared/contracts/masterHost";
import type { ConfigData } from "../config";
import { SEALED_TOKEN_KEY, TOKEN_KEY } from "../connection/constants";
import { unsealedToken, type TokenCipher } from "../connection/token-vault";
import { LOOPBACK_HOSTNAMES, MASTER_HOSTS_KEY } from "./constants";

export interface SavedMasterHost {
  url: string;
  name: string | null;
  token: string;
}

export type MasterHostLinkResult = { ok: true; value: SavedMasterHost } | { ok: false; error: string };

type StoredEntry = Record<string, unknown>;

export function parseMasterHostLink(link: string): MasterHostLinkResult {
  const parsed = parsePairingLink(link, HOST_PAIRING_ACTION);
  if (!parsed.ok) return { ok: false, error: parsed.error.message };
  return { ok: true, value: { url: parsed.value.url, name: parsed.value.name ?? null, token: parsed.value.token } };
}

export function masterHostLink(host: SavedMasterHost): string {
  return buildPairingLink({ url: host.url, token: host.token, name: host.name ?? undefined }, HOST_PAIRING_ACTION);
}

export function isLoopbackUrl(url: string): boolean {
  try {
    return LOOPBACK_HOSTNAMES.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isLocalConnection(config: Pick<ConnectionConfig, "apiUrl" | "source">): boolean {
  return config.source === "docker" || isLoopbackUrl(config.apiUrl);
}

function storedEntries(data: ConfigData): Record<string, StoredEntry> {
  const map = data[MASTER_HOSTS_KEY];
  if (typeof map !== "object" || map === null || Array.isArray(map)) return {};
  const entries: Record<string, StoredEntry> = {};
  for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) entries[key] = value as StoredEntry;
  }
  return entries;
}

function withEntries(data: ConfigData, entries: Record<string, StoredEntry>): ConfigData {
  const next = { ...data };
  if (Object.keys(entries).length) next[MASTER_HOSTS_KEY] = entries;
  else delete next[MASTER_HOSTS_KEY];
  return next;
}

export function readMasterHost(data: ConfigData, sandboxUrl: string, cipher: TokenCipher | null): SavedMasterHost | null {
  const entry = storedEntries(data)[sandboxUrl];
  if (!entry || typeof entry.url !== "string" || !entry.url) return null;
  const plain = typeof entry[TOKEN_KEY] === "string" ? (entry[TOKEN_KEY] as string).trim() : "";
  const token = plain || unsealedToken(entry, cipher);
  if (!token) return null;
  const name = typeof entry.name === "string" && entry.name ? entry.name : null;
  return { url: entry.url, name, token };
}

export function masterHostSummary(data: ConfigData, sandboxUrl: string): MachineHost | null {
  const entry = storedEntries(data)[sandboxUrl];
  if (!entry || typeof entry.url !== "string" || !entry.url) return null;
  return { url: entry.url, name: typeof entry.name === "string" && entry.name ? entry.name : null };
}

export function rememberMasterHost(
  data: ConfigData,
  sandboxUrl: string,
  host: SavedMasterHost,
  sealWith: TokenCipher | null,
): ConfigData {
  const entry: StoredEntry = { url: host.url };
  if (host.name) entry.name = host.name;
  if (sealWith) entry[SEALED_TOKEN_KEY] = sealWith.seal(host.token);
  else entry[TOKEN_KEY] = host.token;
  return withEntries(data, { ...storedEntries(data), [sandboxUrl]: entry });
}

export function dropMasterHost(data: ConfigData, sandboxUrl: string): ConfigData {
  const entries = storedEntries(data);
  if (!(sandboxUrl in entries)) return data;
  delete entries[sandboxUrl];
  return withEntries(data, entries);
}

export function masterHostState(
  config: ConnectionConfig | null,
  saved: SavedMasterHost | null,
  online: boolean,
  local: boolean = config !== null && isLocalConnection(config),
): MasterHostState {
  if (!config) return { kind: "none" };
  if (local) return { kind: "local" };
  if (!saved) return { kind: "unlinked", sandboxUrl: config.apiUrl };
  return {
    kind: "linked",
    sandboxUrl: config.apiUrl,
    host: { link: masterHostLink(saved), url: saved.url, name: saved.name, online },
  };
}

export type HostRoute =
  | { kind: "local" }
  | { kind: "remote"; sandboxUrl: string; host: SavedMasterHost }
  | { kind: "unlinked"; sandboxUrl: string };

export function hostRoute(active: Pick<SavedMachine, "apiUrl" | "local"> | null, saved: SavedMasterHost | null): HostRoute {
  if (!active || active.local) return { kind: "local" };
  return saved ? { kind: "remote", sandboxUrl: active.apiUrl, host: saved } : { kind: "unlinked", sandboxUrl: active.apiUrl };
}

export function hostRouteKey(route: HostRoute): string {
  if (route.kind === "local") return route.kind;
  if (route.kind === "unlinked") return `${route.kind}|${route.sandboxUrl}`;
  return `${route.kind}|${route.sandboxUrl}|${route.host.url}|${route.host.token}|${route.host.name ?? ""}`;
}
