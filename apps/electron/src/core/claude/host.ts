import { lstat, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { HostClaudeLogin, HostClaudeSettings, HostClaudeState } from "../../shared/contracts/claude";
import { IpcError } from "../../shared/ipc-types";
import {
  CLAUDE_DIR_MODE,
  CLAUDE_MD_FILE,
  CONFIG_DIR_ENV,
  CREDENTIALS_FILE,
  CREDENTIALS_KEY,
  EXTENSION_DIRS,
  EXTRA_ACCOUNT_PATTERN,
  GLOBAL_CONFIG_FILE,
  IGNORED_DIRS,
  OAUTH_ACCOUNT_KEY,
  PRIMARY_ACCOUNT_ID,
  PRIMARY_DIR_NAME,
  SETTINGS_FILE,
} from "./constants";
import { CLAUDE_LABELS } from "./labels";

export interface ClaudeEnvironment {
  home: string;
  env: Record<string, string | undefined>;
  platform: NodeJS.Platform;
}

export interface HostClaudePaths {
  configDir: string;
  globalConfig: string;
}

export interface HostClaudeAccount {
  id: string;
  primary: boolean;
  paths: HostClaudePaths;
}

type JsonObject = Record<string, unknown>;

export function expandHome(path: string, home: string): string {
  if (path === "~") return home;
  if (path.startsWith("~/") || path.startsWith("~\\")) return join(home, path.slice(2));
  return path;
}

export function primaryPaths({ env, home }: ClaudeEnvironment): HostClaudePaths {
  const custom = env[CONFIG_DIR_ENV];
  if (custom) {
    const configDir = expandHome(custom, home);
    return { configDir, globalConfig: join(configDir, GLOBAL_CONFIG_FILE) };
  }
  return { configDir: join(home, PRIMARY_DIR_NAME), globalConfig: join(home, GLOBAL_CONFIG_FILE) };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isRegularFile(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

export async function readJsonObject(path: string): Promise<JsonObject | null> {
  try {
    const data: unknown = JSON.parse(await readFile(path, "utf8"));
    return typeof data === "object" && data !== null && !Array.isArray(data) ? (data as JsonObject) : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function objectAt(data: JsonObject | null, key: string): JsonObject | null {
  const value = data?.[key];
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : null;
}

export async function hostClaudeAccounts(environment: ClaudeEnvironment): Promise<HostClaudeAccount[]> {
  const primary = primaryPaths(environment);
  const accounts: HostClaudeAccount[] = [{ id: PRIMARY_ACCOUNT_ID, primary: true, paths: primary }];
  let entries: string[];
  try {
    entries = (await readdir(environment.home)).sort();
  } catch {
    return accounts;
  }
  const primaryDir = resolve(primary.configDir);
  for (const name of entries) {
    const match = EXTRA_ACCOUNT_PATTERN.exec(name);
    if (!match) continue;
    const configDir = join(environment.home, name);
    if (resolve(configDir) === primaryDir) continue;
    if (!(await isDirectory(configDir)) || !(await isFile(join(configDir, CREDENTIALS_FILE)))) continue;
    accounts.push({
      id: `${PRIMARY_ACCOUNT_ID}-${match[1]}`,
      primary: false,
      paths: { configDir, globalConfig: join(configDir, GLOBAL_CONFIG_FILE) },
    });
  }
  return accounts;
}

export async function readOauth(configDir: string): Promise<{ oauth: JsonObject | null; issue: HostClaudeLogin | null }> {
  const path = join(configDir, CREDENTIALS_FILE);
  if (!(await isFile(path))) return { oauth: null, issue: "missing" };
  const oauth = objectAt(await readJsonObject(path), CREDENTIALS_KEY);
  if (!oauth || !text(oauth.accessToken)) return { oauth: null, issue: "invalid" };
  return { oauth, issue: null };
}

export async function readLogin(
  paths: HostClaudePaths,
  platform: NodeJS.Platform,
): Promise<{ oauth: JsonObject | null; login: HostClaudeLogin }> {
  const { oauth, issue } = await readOauth(paths.configDir);
  if (oauth) return { oauth, login: "signed-in" };
  if (platform === "darwin" && issue === "missing") return { oauth: null, login: "keychain" };
  return { oauth: null, login: issue ?? "missing" };
}

async function countRegularFiles(root: string): Promise<number> {
  try {
    const info = await lstat(root);
    if (!info.isDirectory()) return 0;
  } catch {
    return 0;
  }
  let count = 0;
  const pending = [root];
  while (pending.length > 0) {
    const dir = pending.pop() as string;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) pending.push(join(dir, entry.name));
      } else if (entry.isFile()) count += 1;
    }
  }
  return count;
}

export async function readClaudeSettings(configDir: string): Promise<HostClaudeSettings> {
  const [settingsJson, claudeMd, skills, agents, commands, outputStyles] = await Promise.all([
    isRegularFile(join(configDir, SETTINGS_FILE)),
    isRegularFile(join(configDir, CLAUDE_MD_FILE)),
    countRegularFiles(join(configDir, EXTENSION_DIRS.skills)),
    countRegularFiles(join(configDir, EXTENSION_DIRS.agents)),
    countRegularFiles(join(configDir, EXTENSION_DIRS.commands)),
    countRegularFiles(join(configDir, EXTENSION_DIRS.outputStyles)),
  ]);
  return { settingsJson, claudeMd, skills, agents, commands, outputStyles };
}

function expiry(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function readHostClaudeState(account: HostClaudeAccount, platform: NodeJS.Platform): Promise<HostClaudeState> {
  const [{ oauth, login }, globalConfig, settings] = await Promise.all([
    readLogin(account.paths, platform),
    readJsonObject(account.paths.globalConfig),
    readClaudeSettings(account.paths.configDir),
  ]);
  const profile = objectAt(globalConfig, OAUTH_ACCOUNT_KEY);
  return {
    id: account.id,
    configDir: account.paths.configDir,
    primary: account.primary,
    login,
    email: text(profile?.emailAddress),
    displayName: text(profile?.displayName),
    organization: text(profile?.organizationName),
    subscriptionType: oauth ? text(oauth.subscriptionType) : null,
    expiresAt: oauth ? expiry(oauth.expiresAt) : null,
    settings,
  };
}

export async function readHostClaudeStates(environment: ClaudeEnvironment): Promise<HostClaudeState[]> {
  const accounts = await hostClaudeAccounts(environment);
  return Promise.all(accounts.map((account) => readHostClaudeState(account, environment.platform)));
}

export async function ensureClaudeDir(environment: ClaudeEnvironment): Promise<{ path: string; created: boolean }> {
  const path = primaryPaths(environment).configDir;
  try {
    const info = await stat(path);
    if (!info.isDirectory()) throw new IpcError("invalid_argument", CLAUDE_LABELS.notADirectory(path));
    return { path, created: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(path, { recursive: true, mode: CLAUDE_DIR_MODE });
  return { path, created: true };
}
