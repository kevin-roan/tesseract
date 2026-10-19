import { join } from "node:path";
import { BrowserWindow } from "electron";
import { readConfig, updateConfig } from "../../core/config";
import {
  CONNECTION_MESSAGES,
  discoverDocker,
  discoveryDisabled,
  dropMachine,
  findMachine,
  isLocalMachine,
  listMachines,
  MACHINE_STATUS,
  markLocalMachine,
  normalizeConnectionInput,
  probeMachineStatuses,
  releaseMachine,
  linkMachineHost,
  renameMachine,
  resolveConnectionInput,
  sameStatuses,
  sealPlainToken,
  shouldSealTokens,
  stackProject,
  storeConnection,
  storeMachine,
  type MachineStatuses,
  type TokenCipher,
} from "../../core/connection";
import { effectiveEnv } from "../../core/docker";
import { dropMasterHost, parseMasterHostLink, type SavedMasterHost } from "../../core/master-host";
import { createLogger } from "../../core/log";
import { CONFIG_FILE_NAME } from "../../core/paths";
import type {
  AddMachineOptions,
  ConnectionConfig,
  ConnectionInput,
  ConnectionSnapshot,
  DiscoveryResult,
  SavedMachine,
} from "../../shared/contracts/connection";
import { IpcError } from "../../shared/ipc-types";
import { mainContext } from "../context";
import { localHost, onLocalHostChanged } from "../services/local-host";
import { storedConnection, tokenCipher } from "../services/token-cipher";
import { defineService } from "./_framework/define";
import { broadcast } from "./_framework/events";

const log = createLogger("connection");

let discovered: ConnectionConfig | null = null;
let localSandbox: ConnectionConfig | null = null;
let discovery: AbortController | null = null;
let localDiscovery: AbortController | null = null;
let statuses: MachineStatuses = {};
let probing: Promise<void> | null = null;
let lastProbe = 0;
const listeners = new Set<(snapshot: ConnectionSnapshot) => void>();

export function onConnectionChanged(listener: (snapshot: ConnectionSnapshot) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function sealer(): TokenCipher | null {
  const context = mainContext();
  const seal = shouldSealTokens({
    platform: process.platform,
    env: process.env,
    configFile: context.configFile,
    defaultConfigFile: join(context.paths.userData ?? "", CONFIG_FILE_NAME),
    test: context.isTest || context.fixtures,
    cipher: tokenCipher,
  });
  return seal ? tokenCipher : null;
}

function configFile(): string {
  return mainContext().configFile;
}

export async function connectionSnapshot(): Promise<ConnectionSnapshot> {
  const file = configFile();
  const data = await readConfig(file);
  const config = discovered ?? storedConnection(data);
  const machines = listMachines(data, config, { local: localSandbox, statuses, localHost: localHost() });
  return { config, configFile: file, machines };
}

export async function activeConnection(): Promise<ConnectionConfig | null> {
  return (await connectionSnapshot()).config;
}

export async function publishConnectionChanged(): Promise<ConnectionSnapshot> {
  const result = await connectionSnapshot();
  broadcast("connection", "changed", result);
  for (const listener of listeners) listener(result);
  return result;
}

const changed = publishConnectionChanged;

function inputOf(config: ConnectionInput): ConnectionInput {
  return { apiUrl: config.apiUrl, token: config.token, name: config.name ?? null, pairingUrl: config.pairingUrl ?? null };
}

function machineById(snapshot: ConnectionSnapshot, id: unknown): SavedMachine | null {
  return typeof id === "string" ? (snapshot.machines.find((item) => item.id === id) ?? null) : null;
}

function requireMachine(snapshot: ConnectionSnapshot, id: unknown): SavedMachine {
  const machine = machineById(snapshot, id);
  if (!machine) throw new IpcError("not_found", CONNECTION_MESSAGES.unknownMachine);
  return machine;
}

function requireHostLink(link: unknown): SavedMasterHost {
  const parsed = parseMasterHostLink(typeof link === "string" ? link : "");
  if (!parsed.ok) throw new IpcError("invalid_argument", CONNECTION_MESSAGES.invalidHostLink(parsed.error));
  return parsed.value;
}

function dropSaved(machine: Pick<SavedMachine, "id" | "local">): Promise<unknown> {
  return updateConfig(configFile(), (data) => {
    const next = machine.local ? releaseMachine(markLocalMachine(data, machine.id), machine.id) : dropMachine(data, machine.id);
    return dropMasterHost(next, machine.id);
  });
}

function forgetStatus(id: string): void {
  const next = { ...statuses };
  delete next[id];
  statuses = next;
}

function probeStatuses(): Promise<void> {
  probing ??= (async () => {
    const current = await connectionSnapshot();
    const next = await probeMachineStatuses(current.machines.map((item) => item.apiUrl));
    lastProbe = Date.now();
    if (sameStatuses(statuses, next)) return;
    statuses = next;
    await changed();
  })()
    .catch((error: unknown) => log.warn(`status probe failed: ${String(error)}`))
    .finally(() => {
      probing = null;
    });
  return probing;
}

function probeIfStale(): void {
  if (Date.now() - lastProbe >= MACHINE_STATUS.staleMs) void probeStatuses();
}

function windowsOpen(): boolean {
  return BrowserWindow.getAllWindows().some((window) => !window.isDestroyed() && window.isVisible());
}

async function probeOne(url: string): Promise<void> {
  const next = await probeMachineStatuses([url]);
  statuses = { ...statuses, ...next };
}

function cancelDiscovery(): void {
  discovery?.abort();
  discovery = null;
}

async function rememberLocal(config: ConnectionConfig): Promise<void> {
  localSandbox = config;
  await updateConfig(configFile(), (data) => markLocalMachine(data, config.apiUrl));
}

async function runDiscovery(signal: AbortSignal): Promise<DiscoveryResult> {
  const data = await readConfig(configFile());
  const result = await discoverDocker({ env: effectiveEnv(), project: stackProject(data) ?? undefined, signal });
  if (!signal.aborted && result.ok) await rememberLocal(result.config);
  return result;
}

async function discover(): Promise<DiscoveryResult> {
  cancelDiscovery();
  const controller = new AbortController();
  discovery = controller;
  const result = await runDiscovery(controller.signal);
  if (discovery === controller) discovery = null;
  if (controller.signal.aborted) return result;
  if (result.ok) {
    discovered = result.config;
    await changed();
  } else {
    log.info(`discovery failed: ${result.error}`);
  }
  return result;
}

async function discoverLocalInBackground(): Promise<void> {
  const { fixtures, isTest } = mainContext();
  if (fixtures || isTest || discoveryDisabled(process.env)) return;
  const controller = new AbortController();
  localDiscovery = controller;
  const result = await runDiscovery(controller.signal);
  if (localDiscovery === controller) localDiscovery = null;
  if (controller.signal.aborted) return;
  if (result.ok) await changed();
  else log.info(`local sandbox not found: ${result.error}`);
}

async function persist(value: ConnectionInput, activate: boolean, host: SavedMasterHost | null = null): Promise<void> {
  const sealWith = sealer();
  await updateConfig(configFile(), (data) =>
    storeMachine(data, value, { activate, local: isLocalMachine(value, data, localSandbox), host, sealWith }),
  );
  if (!activate) return;
  cancelDiscovery();
  discovered = null;
}

export async function saveConnection(input: ConnectionInput): Promise<ConnectionSnapshot> {
  const value = normalizeConnectionInput(input);
  if (!value) throw new IpcError("invalid_argument", CONNECTION_MESSAGES.invalidInput);
  await persist(value, true);
  return changed();
}

async function add(input: ConnectionInput, options: AddMachineOptions | undefined): Promise<ConnectionSnapshot> {
  const resolved = resolveConnectionInput(input);
  if (!resolved.ok) throw new IpcError("invalid_argument", resolved.error);
  const value = resolved.value;
  const link = typeof options?.hostLink === "string" && options.hostLink.trim() ? options.hostLink : null;
  const host = link ? requireHostLink(link) : null;
  if (host && isLocalMachine(value, await readConfig(configFile()), localSandbox)) {
    throw new IpcError("invalid_argument", CONNECTION_MESSAGES.localHostLink);
  }
  await persist(value, options?.activate !== false, host);
  await probeOne(value.apiUrl);
  return changed();
}

async function setHostLink(id: string, link: string | null): Promise<ConnectionSnapshot> {
  const machine = requireMachine(await connectionSnapshot(), id);
  if (link === null || (typeof link === "string" && !link.trim())) {
    await updateConfig(configFile(), (data) => linkMachineHost(data, machine.id, null, null));
    return changed();
  }
  if (machine.local) throw new IpcError("invalid_argument", CONNECTION_MESSAGES.localHostLink);
  const host = requireHostLink(link);
  const sealWith = sealer();
  await updateConfig(configFile(), (data) => linkMachineHost(data, machine.id, host, sealWith));
  return changed();
}

async function forgetActive(): Promise<ConnectionSnapshot> {
  await updateConfig(configFile(), (data) => storeConnection(data, null, null));
  cancelDiscovery();
  discovered = null;
  return changed();
}

async function localConnection(id: string): Promise<ConnectionConfig> {
  if (localSandbox) return localSandbox;
  const saved = findMachine(await readConfig(configFile()), id, tokenCipher);
  if (saved) return saved;
  const controller = new AbortController();
  const result = await runDiscovery(controller.signal);
  if (!result.ok) throw new IpcError("unavailable", CONNECTION_MESSAGES.localUnavailable(result.error));
  return result.config;
}

async function switchTo(id: string): Promise<ConnectionSnapshot> {
  const current = await connectionSnapshot();
  if (current.config?.apiUrl === id) return current;
  const listed = machineById(current, id);
  if (listed?.local) return saveConnection(inputOf(await localConnection(id)));
  const machine = typeof id === "string" ? findMachine(await readConfig(configFile()), id, tokenCipher) : null;
  if (!machine) throw new IpcError("not_found", CONNECTION_MESSAGES.unknownMachine);
  return saveConnection(inputOf(machine));
}

async function rename(id: string, name: string): Promise<ConnectionSnapshot> {
  const current = await connectionSnapshot();
  const machine = requireMachine(current, id);
  const label = typeof name === "string" ? name : "";
  const active = current.config;
  if (active?.apiUrl === machine.id) await persist({ ...inputOf(active), name: label.trim() || null }, true);
  else if (machine.local && localSandbox?.apiUrl === machine.id) await persist(inputOf(localSandbox), false);
  await updateConfig(configFile(), (data) => renameMachine(data, machine.id, label));
  return changed();
}

async function remove(id: string): Promise<ConnectionSnapshot> {
  const current = await connectionSnapshot();
  const machine = requireMachine(current, id);
  await dropSaved(machine);
  forgetStatus(machine.id);
  if (current.config?.apiUrl === machine.id) return forgetActive();
  return changed();
}

async function forget(): Promise<ConnectionSnapshot> {
  const current = await connectionSnapshot();
  const active = current.machines.find((item) => item.active);
  if (active) await dropSaved(active);
  return forgetActive();
}

async function refreshStatus(): Promise<ConnectionSnapshot> {
  await probeStatuses();
  return connectionSnapshot();
}

async function migrateToken(): Promise<void> {
  const seal = sealer();
  if (!seal) return;
  await updateConfig(configFile(), (data) => sealPlainToken(data, seal) ?? data);
}

export default defineService(
  "connection",
  {
    load: async () => {
      const result = await connectionSnapshot();
      probeIfStale();
      return result;
    },
    save: (_context, input) => saveConnection(input),
    forget: () => forget(),
    discover: () => discover(),
    switchTo: (_context, id) => switchTo(id),
    rename: (_context, id, name) => rename(id, name),
    remove: (_context, id) => remove(id),
    add: (_context, input, options) => add(input, options),
    setHostLink: (_context, id, link) => setHostLink(id, link),
    refreshStatus: () => refreshStatus(),
  },
  {
    start: async () => {
      await migrateToken().catch((error: unknown) => log.warn(`token migration skipped: ${String(error)}`));
      const stopLocalHost = onLocalHostChanged(() => {
        void changed().catch((error: unknown) => log.warn(`local host broadcast failed: ${String(error)}`));
      });
      const timer = setInterval(() => {
        if (windowsOpen()) void probeStatuses();
      }, MACHINE_STATUS.intervalMs);
      void discoverLocalInBackground().catch((error: unknown) => log.warn(`local discovery failed: ${String(error)}`));
      return () => {
        clearInterval(timer);
        stopLocalHost();
        cancelDiscovery();
        localDiscovery?.abort();
        localDiscovery = null;
      };
    },
  },
);
