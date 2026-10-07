import type { ConnectionConfig } from "../../shared/contracts/connection";
import { CONNECTION_ENV, initialConnection, readConfig } from "../config";
import { discoverDocker, hasSealedToken } from "../connection";
import { configFilePath, currentPathEnvironment } from "../paths";
import { HttpSyncApi, type SyncApi } from "./api";
import { errorMessage } from "./errors";
import { CLI_SYNC_LABELS } from "./labels";

export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}

export interface SyncConnection {
  api: SyncApi;
  label: string;
}

export interface SyncEnvironment {
  stateDir: string;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  configFile?: string;
  connect?: (io: CliIo) => Promise<SyncConnection | null>;
}

export function connectionFor(config: ConnectionConfig): SyncConnection {
  return { api: new HttpSyncApi({ apiUrl: config.apiUrl, token: config.token }), label: config.name || config.apiUrl };
}

async function discovered(env: NodeJS.ProcessEnv, io: CliIo, sealed: boolean): Promise<ConnectionConfig | null | false> {
  const report = (error: string) =>
    io.stderr(sealed ? CLI_SYNC_LABELS.sealedToken(error, CONNECTION_ENV.url, CONNECTION_ENV.token) : CLI_SYNC_LABELS.noSandbox(error));
  try {
    const result = await discoverDocker({ env });
    if (result.ok) return result.config;
    report(result.error);
  } catch (error) {
    report(errorMessage(error));
  }
  return false;
}

export async function connectSandbox(environment: SyncEnvironment, io: CliIo): Promise<SyncConnection | null> {
  if (environment.connect) return environment.connect(io);
  const env = environment.env ?? process.env;
  const file = environment.configFile ?? configFilePath(currentPathEnvironment());
  const data = await readConfig(file);
  let config: ConnectionConfig | null | false = initialConnection(data, env);
  if (!config) config = await discovered(env, io, hasSealedToken(data));
  if (config === false) return null;
  if (!config) {
    io.stderr(CLI_SYNC_LABELS.notConnected);
    return null;
  }
  return connectionFor(config);
}
