import { readConfig, updateConfig } from "../../core/config";
import { createLogger } from "../../core/log";
import {
  dropMasterHost,
  hostRoute,
  MASTER_HOST_LABELS,
  parseMasterHostFolder,
  parseMasterHostLink,
  readMasterHost,
  readMasterHostFolder,
  rememberMasterHost,
  rememberMasterHostFolder,
  resolveMasterHostState,
  type HostRoute,
} from "../../core/master-host";
import type { ConnectionConfig, ConnectionSnapshot, SavedMachine } from "../../shared/contracts/connection";
import type { MasterHostState } from "../../shared/contracts/masterHost";
import { IpcError } from "../../shared/ipc-types";
import { mainContext } from "../context";
import { isPlainProjectId } from "../services/project-id";
import { tokenCipher } from "../services/token-cipher";
import { connectionSnapshot, onConnectionChanged, publishConnectionChanged, sealer } from "./connection";
import { defineService } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";

const events = serviceEmitter("masterHost");
const log = createLogger("master-host");

function activeMachine(snapshot: ConnectionSnapshot): SavedMachine | null {
  return snapshot.machines.find((item) => item.active) ?? null;
}

export async function activeHostRoute(snapshot?: ConnectionSnapshot): Promise<HostRoute> {
  const current = snapshot ?? (await connectionSnapshot());
  const active = activeMachine(current);
  if (!active || active.local) return hostRoute(active, null);
  const data = await readConfig(mainContext().configFile);
  return hostRoute(active, readMasterHost(data, active.apiUrl, tokenCipher));
}

async function state(snapshot?: ConnectionSnapshot): Promise<MasterHostState> {
  const current = snapshot ?? (await connectionSnapshot());
  const data = await readConfig(mainContext().configFile);
  const local = activeMachine(current)?.local;
  return resolveMasterHostState({ config: current.config, data, cipher: tokenCipher, local });
}

async function remoteSandbox(): Promise<ConnectionConfig> {
  const current = await connectionSnapshot();
  if (!current.config) throw new IpcError("unavailable", MASTER_HOST_LABELS.noSandbox);
  if (activeMachine(current)?.local) throw new IpcError("invalid_argument", MASTER_HOST_LABELS.localSandbox);
  return current.config;
}

async function link(value: unknown): Promise<MasterHostState> {
  const parsed = parseMasterHostLink(typeof value === "string" ? value : "");
  if (!parsed.ok) throw new IpcError("invalid_argument", MASTER_HOST_LABELS.invalidLink(parsed.error));
  const config = await remoteSandbox();
  await updateConfig(mainContext().configFile, (data) => rememberMasterHost(data, config.apiUrl, parsed.value, sealer()));
  return state(await publishConnectionChanged());
}

async function unlink(): Promise<MasterHostState> {
  const config = await remoteSandbox();
  await updateConfig(mainContext().configFile, (data) => dropMasterHost(data, config.apiUrl));
  return state(await publishConnectionChanged());
}

function requireProjectId(value: unknown): string {
  if (!isPlainProjectId(value)) throw new IpcError("invalid_argument", MASTER_HOST_LABELS.invalidFolder);
  return value;
}

/** The project's folder on the active sandbox's master host, or `null` for a local sandbox or when none is set. */
export async function masterHostFolder(projectId: unknown): Promise<string | null> {
  const id = requireProjectId(projectId);
  const current = await connectionSnapshot();
  if (!current.config || activeMachine(current)?.local) return null;
  return readMasterHostFolder(await readConfig(mainContext().configFile), current.config.apiUrl, id);
}

async function setFolder(projectId: unknown, path: unknown): Promise<string> {
  const id = requireProjectId(projectId);
  const folder = parseMasterHostFolder(path);
  if (folder === null) throw new IpcError("invalid_argument", MASTER_HOST_LABELS.invalidFolder);
  const config = await remoteSandbox();
  await updateConfig(mainContext().configFile, (data) => rememberMasterHostFolder(data, config.apiUrl, id, folder));
  return folder;
}

export default defineService(
  "masterHost",
  {
    state: () => state(),
    link: (_context, value) => link(value),
    unlink: () => unlink(),
    folder: (_context, projectId) => masterHostFolder(projectId),
    setFolder: (_context, projectId, path) => setFolder(projectId, path),
  },
  {
    start: () =>
      onConnectionChanged((snapshot) => {
        state(snapshot)
          .then((next) => events.emit("state", next))
          .catch((error: unknown) => log.warn(`state broadcast failed: ${String(error)}`));
      }),
  },
);
