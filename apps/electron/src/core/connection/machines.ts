import type {
  ConnectionConfig,
  ConnectionInput,
  MachineHost,
  MachineStatus,
  SavedMachine,
} from "../../shared/contracts/connection";
import { connectionFromJson, type ConfigData } from "../config";
import {
  dropMasterHost,
  isLocalConnection,
  isLoopbackUrl,
  masterHostSummary,
  rememberMasterHost,
  type SavedMasterHost,
} from "../master-host/model";
import { LOCAL_MACHINE_KEY, MACHINE_STATUS, MACHINES_KEY, SEALED_TOKEN_KEY, TOKEN_KEY } from "./constants";
import { probeHealth, type HealthProber } from "./health";
import { storeConnection, unsealedToken, type TokenCipher } from "./token-vault";

type StoredMachine = ConfigData;

export type MachineStatuses = Readonly<Record<string, MachineStatus>>;

export interface MachineContext {
  local?: ConnectionConfig | null;
  statuses?: MachineStatuses;
  localHost?: MachineHost | null;
}

export interface RememberOptions {
  local?: boolean;
}

function storedMachines(data: ConfigData): StoredMachine[] {
  const list = data[MACHINES_KEY];
  if (!Array.isArray(list)) return [];
  return list.filter((entry): entry is StoredMachine => typeof entry === "object" && entry !== null && typeof entry.url === "string");
}

function withMachines(data: ConfigData, machines: StoredMachine[]): ConfigData {
  const next = { ...data };
  if (machines.length) next[MACHINES_KEY] = machines;
  else delete next[MACHINES_KEY];
  return next;
}

function storedName(entry: StoredMachine | undefined): string | null {
  return typeof entry?.name === "string" && entry.name.trim() ? entry.name.trim() : null;
}

function machineConnection(entry: StoredMachine, cipher: TokenCipher | null): ConnectionConfig | null {
  const plain = connectionFromJson(entry, "file");
  if (plain) return plain;
  const token = unsealedToken(entry, cipher);
  return token ? connectionFromJson({ ...entry, [TOKEN_KEY]: token }, "file") : null;
}

function storedEntry(input: ConnectionInput, sealWith: TokenCipher | null, previous: StoredMachine | undefined, local: boolean): StoredMachine {
  const entry: StoredMachine = { url: input.apiUrl };
  const name = local ? storedName(previous) : input.name;
  if (name) entry.name = name;
  if (input.pairingUrl) entry.pairingUrl = input.pairingUrl;
  if (local) entry[LOCAL_MACHINE_KEY] = true;
  if (sealWith) entry[SEALED_TOKEN_KEY] = sealWith.seal(input.token);
  else entry[TOKEN_KEY] = input.token;
  return entry;
}

function updateEntry(data: ConfigData, id: string, update: (entry: StoredMachine) => StoredMachine): ConfigData {
  return withMachines(
    data,
    storedMachines(data).map((item) => (item.url === id ? update(item) : item)),
  );
}

export function rememberMachine(
  data: ConfigData,
  input: ConnectionInput,
  sealWith: TokenCipher | null,
  options: RememberOptions = {},
): ConfigData {
  const list = storedMachines(data);
  const index = list.findIndex((item) => item.url === input.apiUrl);
  const previous = index < 0 ? undefined : list[index];
  const local = options.local === true || previous?.[LOCAL_MACHINE_KEY] === true;
  const entry = storedEntry(input, sealWith, previous, local);
  return withMachines(data, index < 0 ? [...list, entry] : list.map((item, at) => (at === index ? entry : item)));
}

export interface StoreMachineOptions {
  activate: boolean;
  local: boolean;
  host?: SavedMasterHost | null;
  sealWith: TokenCipher | null;
}

export function storeMachine(data: ConfigData, input: ConnectionInput, options: StoreMachineOptions): ConfigData {
  const { sealWith } = options;
  const base = options.activate ? storeConnection(data, input, sealWith) : data;
  const next = rememberMachine(base, input, sealWith, { local: options.local });
  return options.host ? rememberMasterHost(next, input.apiUrl, options.host, sealWith) : next;
}

export function linkMachineHost(data: ConfigData, id: string, host: SavedMasterHost | null, sealWith: TokenCipher | null): ConfigData {
  return host ? rememberMasterHost(data, id, host, sealWith) : dropMasterHost(data, id);
}

export function markLocalMachine(data: ConfigData, id: string): ConfigData {
  const entry = storedMachines(data).find((item) => item.url === id);
  if (!entry || entry[LOCAL_MACHINE_KEY] === true) return data;
  return updateEntry(data, id, (item) => ({ ...item, [LOCAL_MACHINE_KEY]: true }));
}

export function renameMachine(data: ConfigData, id: string, name: string): ConfigData {
  const trimmed = name.trim();
  return updateEntry(data, id, (item) => {
    const next = { ...item };
    if (trimmed) next.name = trimmed;
    else delete next.name;
    return next;
  });
}

export function dropMachine(data: ConfigData, id: string): ConfigData {
  return withMachines(
    data,
    storedMachines(data).filter((item) => item.url !== id),
  );
}

export function isStoredLocalMachine(data: ConfigData, id: string): boolean {
  const entry = storedMachines(data).find((item) => item.url === id);
  return entry !== undefined && (entry[LOCAL_MACHINE_KEY] === true || isLoopbackUrl(id));
}

export function releaseMachine(data: ConfigData, id: string): ConfigData {
  if (!isStoredLocalMachine(data, id)) return dropMachine(data, id);
  return updateEntry(data, id, (item) => {
    const next: StoredMachine = { ...item, [LOCAL_MACHINE_KEY]: true };
    delete next[TOKEN_KEY];
    delete next[SEALED_TOKEN_KEY];
    return next;
  });
}

export function findMachine(data: ConfigData, id: string, cipher: TokenCipher | null): ConnectionConfig | null {
  const entry = storedMachines(data).find((item) => item.url === id);
  return entry ? machineConnection(entry, cipher) : null;
}

export type MachineEndpoint = Pick<ConnectionConfig, "apiUrl"> & Partial<Pick<ConnectionConfig, "source">>;

export function isLocalMachine(config: MachineEndpoint, data: ConfigData, local: ConnectionConfig | null = null): boolean {
  return isLocalConnection({ apiUrl: config.apiUrl, source: config.source ?? "file" }) || config.apiUrl === local?.apiUrl || isStoredLocalMachine(data, config.apiUrl);
}

function machine(id: string, name: string | null, local: boolean, active: boolean, data: ConfigData, context: MachineContext): SavedMachine {
  return {
    id,
    apiUrl: id,
    name,
    active,
    local,
    status: context.statuses?.[id] ?? "unknown",
    host: local ? (context.localHost ?? null) : masterHostSummary(data, id),
  };
}

export function listMachines(data: ConfigData, active: ConnectionConfig | null, context: MachineContext = {}): SavedMachine[] {
  const localUrl = context.local?.apiUrl ?? null;
  const saved = storedMachines(data).map((item) => {
    const id = item.url as string;
    const local = item[LOCAL_MACHINE_KEY] === true || id === localUrl || isLoopbackUrl(id);
    return machine(id, storedName(item), local, id === active?.apiUrl, data, context);
  });
  const known = new Set(saved.map((item) => item.id));
  const extra: SavedMachine[] = [];
  if (active && !known.has(active.apiUrl)) {
    const local = isLocalMachine(active, data, context.local ?? null);
    extra.push(machine(active.apiUrl, local ? null : active.name, local, true, data, context));
    known.add(active.apiUrl);
  }
  if (context.local && localUrl && !known.has(localUrl)) extra.push(machine(localUrl, null, true, false, data, context));
  return [...extra, ...saved].sort((a, b) => Number(b.local) - Number(a.local));
}

export async function probeMachineStatuses(
  urls: readonly string[],
  prober: HealthProber = probeHealth,
  timeoutMs: number = MACHINE_STATUS.timeoutMs,
): Promise<Record<string, MachineStatus>> {
  const results = await Promise.all(urls.map((url) => prober(url, timeoutMs).catch(() => false)));
  return Object.fromEntries(urls.map((url, index) => [url, results[index] ? "online" : "offline"]));
}

export function sameStatuses(a: MachineStatuses, b: MachineStatuses): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if ((a[key] ?? "unknown") !== (b[key] ?? "unknown")) return false;
  return true;
}
