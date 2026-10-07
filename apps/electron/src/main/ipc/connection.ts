import { join } from "node:path";
import { readConfig, updateConfig } from "../../core/config";
import {
  CONNECTION_MESSAGES,
  discoverDocker,
  normalizeConnectionInput,
  sealPlainToken,
  shouldSealTokens,
  stackProject,
  storeConnection,
  type TokenCipher,
} from "../../core/connection";
import { effectiveEnv } from "../../core/docker";
import { createLogger } from "../../core/log";
import { CONFIG_FILE_NAME } from "../../core/paths";
import type { ConnectionConfig, ConnectionInput, ConnectionSnapshot, DiscoveryResult } from "../../shared/contracts/connection";
import { IpcError } from "../../shared/ipc-types";
import { mainContext } from "../context";
import { storedConnection, tokenCipher } from "../services/token-cipher";
import { defineService } from "./_framework/define";
import { broadcast } from "./_framework/events";

const log = createLogger("connection");

let discovered: ConnectionConfig | null = null;
let discovery: AbortController | null = null;

function sealer(): TokenCipher | null {
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

async function snapshot(): Promise<ConnectionSnapshot> {
  const { configFile } = mainContext();
  const data = await readConfig(configFile);
  return { config: discovered ?? storedConnection(data), configFile };
}

async function changed(): Promise<ConnectionSnapshot> {
  const result = await snapshot();
  broadcast("connection", "changed", result);
  return result;
}

function cancelDiscovery(): void {
  discovery?.abort();
  discovery = null;
}

async function discover(): Promise<DiscoveryResult> {
  cancelDiscovery();
  const controller = new AbortController();
  discovery = controller;
  const data = await readConfig(mainContext().configFile);
  const result = await discoverDocker({
    env: effectiveEnv(),
    project: stackProject(data) ?? undefined,
    signal: controller.signal,
  });
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

export async function saveConnection(input: ConnectionInput): Promise<ConnectionSnapshot> {
  const value = normalizeConnectionInput(input);
  if (!value) throw new IpcError("invalid_argument", CONNECTION_MESSAGES.invalidInput);
  const seal = sealer();
  await updateConfig(mainContext().configFile, (data) => storeConnection(data, value, seal));
  cancelDiscovery();
  discovered = null;
  return changed();
}

async function migrateToken(): Promise<void> {
  const seal = sealer();
  if (!seal) return;
  await updateConfig(mainContext().configFile, (data) => sealPlainToken(data, seal) ?? data);
}

export default defineService(
  "connection",
  {
    load: () => snapshot(),
    save: (_context, input) => saveConnection(input),
    forget: async () => {
      await updateConfig(mainContext().configFile, (data) => storeConnection(data, null, null));
      cancelDiscovery();
      discovered = null;
      return changed();
    },
    discover: () => discover(),
  },
  {
    start: async () => {
      await migrateToken().catch((error: unknown) => log.warn(`token migration skipped: ${String(error)}`));
      return cancelDiscovery;
    },
  },
);
