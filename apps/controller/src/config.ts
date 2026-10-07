import { chmodSync, mkdirSync } from "node:fs";
import { homedir, hostname as osHostname, tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { CLAUDE_ACCOUNT_NAME_PATTERN, CLAUDE_PRIMARY_ACCOUNT_ID, DEFAULT_ADB_TUNNEL_PORT, DEFAULT_PORT, isValidToken, parseBaseUrl, STT_PROFILES, type SttProfile } from "@theone/protocol";
import { isLogLevel, type LogLevel } from "./core/logger";
import type { Env } from "./core/exec";

export type Config = {
  host: string;
  port: number;
  workspace: string;
  projectsDir: string;
  artifactsDir: string;
  uploadsDir: string;
  agentDir: string;
  dataDir: string;
  /** Where `DELETE /v1/projects/:id` moves projects. */
  trashDir: string;
  logsDir: string;
  dbPath: string;
  tokenFromEnv: string | null;
  tokenFile: string;
  publicUrl: string;
  display: string;
  vncHost: string;
  vncPort: number;
  vncPassword: string | null;
  chromiumDebugPort: number;
  claudeBin: string;
  claudePermissionMode: string;
  claudeConfigDir: string;
  /** Claude Code's global config: `$CLAUDE_CONFIG_DIR/.claude.json` when the variable is set, else `$HOME/.claude.json`. */
  claudeGlobalConfig: string;
  claudeEnvAuth: { oauthToken: boolean; apiKey: boolean };
  /** The primary account (`claudeConfigDir`) first, then one per `THEONE_CLAUDE_ACCOUNTS` name. */
  claudeAccounts: ClaudeAccountDir[];
  tailscaleSocket: string;
  sandboxId: string;
  hostname: string;
  logLevel: LogLevel;
  corsOrigins: string[];
  shell: string[];
  ffmpegBin: string;
  /** adb client for `adb connect`/`disconnect` of the tunnel to the host emulator. */
  adbBin: string;
  /** Loopback port tunnelled to the host emulator's adbd; the adb serial is `127.0.0.1:<port>`. */
  adbTunnelPort: number;
  /** Flutter SDK entry point used by the `flutter-*` and Flutter `test` run targets. */
  flutterBin: string;
  stt: SttConfig;
  push: PushConfig;
  apns: ApnsConfig;
};

/** A Claude Code config dir; `env` is what children need to use it (empty for the primary, which they inherit). */
export type ClaudeAccountDir = {
  id: string;
  configDir: string;
  globalConfig: string;
  env: Record<string, string>;
};

export const APNS_ENVIRONMENTS = ["production", "sandbox"] as const;
export type ApnsEnvironment = (typeof APNS_ENVIRONMENTS)[number];

/** ActivityKit pushes go straight to APNs; `enabled` needs the key file, key id and team id. */
export type ApnsConfig = {
  enabled: boolean;
  keyFile: string | null;
  keyId: string | null;
  teamId: string | null;
  bundleId: string;
  environment: ApnsEnvironment;
};

export type PushConfig = {
  url: string | null;
  accessToken: string | null;
};

export const STT_ENGINES = ["auto", "whisper.cpp", "openai-compatible", "none"] as const;
export type SttEngineSetting = (typeof STT_ENGINES)[number];

export type SttConfig = {
  engine: SttEngineSetting;
  /** Profile used until one is chosen through `PUT /v1/stt` (then the stored choice wins). */
  profile: SttProfile;
  whisperBin: string;
  whisperModelsDir: string;
  whisperModel: string | null;
  url: string | null;
  apiKey: string | null;
  model: string;
  geminiModel: string;
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
const STT_MODEL_PATTERN = /^[\w.:/-]{1,128}$/;
const APNS_ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;
const BUNDLE_ID_PATTERN = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const DEFAULT_APNS_BUNDLE_ID = "com.kevinbpract.theone";

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

function httpUrl(env: Env, name: string): string | null {
  const raw = read(env, name);
  if (raw === undefined) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`${name} must be an http(s) URL (got "${raw}")`);
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || url.search || url.hash) {
    throw new ConfigError(`${name} must be an http(s) URL without credentials, query or fragment (got "${raw}")`);
  }
  return url.href.replace(/\/+$/, "");
}

function sttConfig(env: Env): SttConfig {
  const engine = read(env, "THEONE_STT_ENGINE") ?? "whisper.cpp";
  if (!STT_ENGINES.includes(engine as SttEngineSetting)) {
    throw new ConfigError(`THEONE_STT_ENGINE must be ${STT_ENGINES.join(", ")} (got "${engine}")`);
  }
  const profile = read(env, "THEONE_STT_PROFILE") ?? "eco";
  if (!STT_PROFILES.includes(profile as SttProfile)) {
    throw new ConfigError(`THEONE_STT_PROFILE must be ${STT_PROFILES.join(", ")} (got "${profile}")`);
  }
  const model = read(env, "THEONE_STT_MODEL") ?? "whisper-1";
  if (!STT_MODEL_PATTERN.test(model)) throw new ConfigError(`THEONE_STT_MODEL is not a valid model name (got "${model}")`);
  const geminiModel = read(env, "THEONE_GEMINI_STT_MODEL") ?? "gemini-2.5-flash";
  if (!STT_MODEL_PATTERN.test(geminiModel)) throw new ConfigError(`THEONE_GEMINI_STT_MODEL is not a valid model name (got "${geminiModel}")`);
  const whisperModel = read(env, "THEONE_WHISPER_MODEL");
  return {
    engine: engine as SttEngineSetting,
    profile: profile as SttProfile,
    whisperBin: read(env, "THEONE_WHISPER_BIN") ?? "whisper-cli",
    whisperModelsDir: absolutePath(env, "THEONE_WHISPER_MODELS_DIR", "/opt/whisper/models"),
    whisperModel: whisperModel === undefined ? null : absolutePath(env, "THEONE_WHISPER_MODEL", whisperModel),
    url: httpUrl(env, "THEONE_STT_URL"),
    apiKey: read(env, "THEONE_STT_API_KEY") ?? null,
    model,
    geminiModel,
  };
}

const DEFAULT_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function pushConfig(env: Env): PushConfig {
  return {
    url: read(env, "THEONE_PUSH_URL") === "off" ? null : (httpUrl(env, "THEONE_PUSH_URL") ?? DEFAULT_PUSH_URL),
    accessToken: read(env, "THEONE_EXPO_ACCESS_TOKEN") ?? null,
  };
}

function apnsConfig(env: Env): ApnsConfig {
  const keyFileRaw = read(env, "THEONE_APNS_KEY_FILE");
  const keyFile = keyFileRaw === undefined ? null : absolutePath(env, "THEONE_APNS_KEY_FILE", keyFileRaw);
  const ids = { THEONE_APNS_KEY_ID: read(env, "THEONE_APNS_KEY_ID") ?? null, THEONE_APNS_TEAM_ID: read(env, "THEONE_APNS_TEAM_ID") ?? null };
  for (const [name, value] of Object.entries(ids)) {
    if (value !== null && !APNS_ID_PATTERN.test(value)) throw new ConfigError(`${name} must be 1-64 letters or digits (got "${value}")`);
  }
  const bundleId = read(env, "THEONE_APNS_BUNDLE_ID") ?? DEFAULT_APNS_BUNDLE_ID;
  if (!BUNDLE_ID_PATTERN.test(bundleId)) throw new ConfigError(`THEONE_APNS_BUNDLE_ID is not a valid bundle id (got "${bundleId}")`);
  const environment = read(env, "THEONE_APNS_ENV") ?? "production";
  if (!APNS_ENVIRONMENTS.includes(environment as ApnsEnvironment)) {
    throw new ConfigError(`THEONE_APNS_ENV must be ${APNS_ENVIRONMENTS.join(" or ")} (got "${environment}")`);
  }
  const values = { THEONE_APNS_KEY_FILE: keyFile, ...ids };
  const set = Object.entries(values).filter(([, value]) => value !== null).map(([name]) => name);
  if (set.length > 0 && set.length < 3) {
    const missing = Object.keys(values).filter((name) => !set.includes(name));
    throw new ConfigError(`${set.join(", ")} need ${missing.join(" and ")} as well (Live Activity pushes)`);
  }
  return { enabled: set.length === 3, keyFile, keyId: ids.THEONE_APNS_KEY_ID, teamId: ids.THEONE_APNS_TEAM_ID, bundleId, environment: environment as ApnsEnvironment };
}

function claudeAccountDirs(env: Env, home: string, primary: ClaudeAccountDir): ClaudeAccountDir[] {
  const names = (read(env, "THEONE_CLAUDE_ACCOUNTS") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  const accounts = [primary];
  for (const name of new Set(names)) {
    if (!CLAUDE_ACCOUNT_NAME_PATTERN.test(name)) throw new ConfigError(`THEONE_CLAUDE_ACCOUNTS has an invalid account name (got "${name}")`);
    const configDir = join(home, `.claude-${name}`);
    accounts.push({ id: `${CLAUDE_PRIMARY_ACCOUNT_ID}-${name}`, configDir, globalConfig: join(configDir, ".claude.json"), env: { CLAUDE_CONFIG_DIR: configDir } });
  }
  return accounts;
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

  const home = read(env, "HOME") ?? homedir();
  const claudeConfigDir = absolutePath(env, "CLAUDE_CONFIG_DIR", join(home, ".claude"));
  const claudeGlobalConfig = read(env, "CLAUDE_CONFIG_DIR") ? join(claudeConfigDir, ".claude.json") : join(home, ".claude.json");
  const hostname = osHostname();
  return {
    host,
    port,
    workspace,
    projectsDir: join(workspace, "projects"),
    artifactsDir: join(workspace, "artifacts"),
    uploadsDir: join(workspace, ".theone", "uploads"),
    agentDir,
    dataDir,
    trashDir: join(tmpdir(), "theone-deleted-projects"),
    logsDir: join(dataDir, "logs"),
    dbPath: join(dataDir, "state.db"),
    tokenFromEnv,
    tokenFile,
    publicUrl: publicUrl.value,
    display,
    vncHost: read(env, "THEONE_VNC_HOST") ?? "127.0.0.1",
    vncPort: parsePort(env, "THEONE_VNC_PORT", 5901, false),
    vncPassword: read(env, "THEONE_VNC_PASSWORD") ?? null,
    chromiumDebugPort: parsePort(env, "THEONE_CHROMIUM_DEBUG_PORT", 9222, false),
    claudeBin: read(env, "THEONE_CLAUDE_BIN") ?? "claude",
    claudePermissionMode,
    claudeConfigDir,
    claudeGlobalConfig,
    claudeEnvAuth: { oauthToken: read(env, "CLAUDE_CODE_OAUTH_TOKEN") !== undefined, apiKey: read(env, "ANTHROPIC_API_KEY") !== undefined },
    claudeAccounts: claudeAccountDirs(env, home, { id: CLAUDE_PRIMARY_ACCOUNT_ID, configDir: claudeConfigDir, globalConfig: claudeGlobalConfig, env: {} }),
    tailscaleSocket: absolutePath(env, "THEONE_TAILSCALE_SOCKET", "/run/tailscale/tailscaled.sock"),
    sandboxId: read(env, "THEONE_SANDBOX_ID") ?? hostname,
    hostname,
    logLevel,
    corsOrigins: corsOrigins.length ? corsOrigins : ["*"],
    shell: shellCommand(env),
    ffmpegBin: read(env, "THEONE_FFMPEG_BIN") ?? "ffmpeg",
    adbBin: read(env, "THEONE_ADB") ?? "adb",
    adbTunnelPort: parsePort(env, "THEONE_ADB_TUNNEL_PORT", DEFAULT_ADB_TUNNEL_PORT, false),
    flutterBin: read(env, "THEONE_FLUTTER") ?? "flutter",
    stt: sttConfig(env),
    push: pushConfig(env),
    apns: apnsConfig(env),
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
