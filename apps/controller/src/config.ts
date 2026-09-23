import { chmodSync, mkdirSync } from "node:fs";
import { hostname as osHostname } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { DEFAULT_PORT, isValidToken, parseBaseUrl } from "@theone/protocol";
import { isLogLevel, type LogLevel } from "./core/logger";
import type { Env } from "./core/exec";

export type Config = {
  host: string;
  port: number;
  workspace: string;
  projectsDir: string;
  artifactsDir: string;
  agentDir: string;
  dataDir: string;
  logsDir: string;
  dbPath: string;
  tokenFromEnv: string | null;
  tokenFile: string;
  publicUrl: string;
  display: string;
  vncHost: string;
  vncPort: number;
  vncPassword: string | null;
  claudeBin: string;
  claudePermissionMode: string;
  sandboxId: string;
  hostname: string;
  logLevel: LogLevel;
  corsOrigins: string[];
  shell: string[];
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const DISPLAY_PATTERN = /^[A-Za-z0-9.-]*:\d+(?:\.\d+)?$/;
const PERMISSION_MODE_PATTERN = /^[A-Za-z]{1,32}$/;
const HOST_PATTERN = /^[A-Za-z0-9.:[\]-]+$/;

function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function parsePort(env: Env, name: string, fallback: number, allowEphemeral: boolean): number {
  const raw = read(env, name);
  if (raw === undefined) return fallback;
  const port = Number(raw);
  const min = allowEphemeral ? 0 : 1;
  if (!/^\d+$/.test(raw) || port < min || port > 65535) {
    throw new ConfigError(`${name} must be an integer between ${min} and 65535 (got "${raw}")`);
  }
  return port;
}

function absolutePath(env: Env, name: string, fallback: string): string {
  const value = read(env, name) ?? fallback;
  if (!isAbsolute(value)) throw new ConfigError(`${name} must be an absolute path (got "${value}")`);
  return resolve(value);
}

function shellCommand(env: Env): string[] {
  const shell = read(env, "SHELL");
  return shell ? [shell, "-l"] : ["bash", "-l"];
}

export function loadConfig(env: Env = process.env): Config {
  const host = read(env, "THEONE_HOST") ?? "0.0.0.0";
  if (!HOST_PATTERN.test(host)) throw new ConfigError(`THEONE_HOST is not a valid bind address (got "${host}")`);
  const port = parsePort(env, "THEONE_PORT", DEFAULT_PORT, true);
  const workspace = absolutePath(env, "THEONE_WORKSPACE", "/workspace");
  const agentDir = join(workspace, ".agent");
  const dataDir = absolutePath(env, "THEONE_DATA_DIR", join(agentDir, "controller"));
  const tokenFile = absolutePath(env, "THEONE_TOKEN_FILE", join(dataDir, "token"));

  const tokenFromEnv = read(env, "THEONE_TOKEN") ?? null;
  if (tokenFromEnv !== null && !isValidToken(tokenFromEnv)) {
    throw new ConfigError("THEONE_TOKEN must be 1-1024 printable ASCII characters without spaces");
  }

  const publicUrlInput = read(env, "THEONE_PUBLIC_URL") ?? `http://127.0.0.1:${port || DEFAULT_PORT}`;
  const publicUrl = parseBaseUrl(publicUrlInput);
  if (!publicUrl.ok) throw new ConfigError(`THEONE_PUBLIC_URL is invalid: ${publicUrl.error.message}`);

  const display = read(env, "THEONE_DISPLAY") ?? ":1";
  if (!DISPLAY_PATTERN.test(display)) throw new ConfigError(`THEONE_DISPLAY must look like ":1" (got "${display}")`);

  const claudePermissionMode = read(env, "THEONE_CLAUDE_PERMISSION_MODE") ?? "bypassPermissions";
  if (!PERMISSION_MODE_PATTERN.test(claudePermissionMode)) {
    throw new ConfigError(`THEONE_CLAUDE_PERMISSION_MODE is not a valid mode name (got "${claudePermissionMode}")`);
  }

  const logLevel = read(env, "THEONE_LOG_LEVEL") ?? "info";
  if (!isLogLevel(logLevel)) throw new ConfigError(`THEONE_LOG_LEVEL must be debug, info, warn or error (got "${logLevel}")`);

  const corsOrigins = (read(env, "THEONE_CORS_ORIGINS") ?? "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const hostname = osHostname();
  return {
    host,
    port,
    workspace,
    projectsDir: join(workspace, "projects"),
    artifactsDir: join(workspace, "artifacts"),
    agentDir,
    dataDir,
    logsDir: join(dataDir, "logs"),
    dbPath: join(dataDir, "state.db"),
    tokenFromEnv,
    tokenFile,
    publicUrl: publicUrl.value,
    display,
    vncHost: read(env, "THEONE_VNC_HOST") ?? "127.0.0.1",
    vncPort: parsePort(env, "THEONE_VNC_PORT", 5901, false),
    vncPassword: read(env, "THEONE_VNC_PASSWORD") ?? null,
    claudeBin: read(env, "THEONE_CLAUDE_BIN") ?? "claude",
    claudePermissionMode,
    sandboxId: read(env, "THEONE_SANDBOX_ID") ?? hostname,
    hostname,
    logLevel,
    corsOrigins: corsOrigins.length ? corsOrigins : ["*"],
    shell: shellCommand(env),
  };
}

export function ensureDirectories(config: Config): void {
  for (const dir of [config.workspace, config.projectsDir, config.artifactsDir, config.agentDir]) {
    mkdirSync(dir, { recursive: true });
  }
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  chmodSync(config.dataDir, 0o700);
  mkdirSync(config.logsDir, { recursive: true, mode: 0o700 });
}

const WILDCARD_HOSTS = new Set(["0.0.0.0", "::", "[::]"]);

/** Where the CLI reaches the local daemon: the bind address unless it is a wildcard. */
export function localApiUrl(config: Config): string {
  let host = WILDCARD_HOSTS.has(config.host) ? "127.0.0.1" : config.host;
  if (host.includes(":") && !host.startsWith("[")) host = `[${host}]`;
  return `http://${host}:${config.port || DEFAULT_PORT}`;
}
