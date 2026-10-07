import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CLAUDE_IMPORT_ACCOUNT_KEYS,
  ClaudeOauthCredentialsSchema,
  LIMITS,
  type ClaudeImport,
  type ClaudeImportFile,
  type ClaudeImportResult,
  type ClaudeOauthCredentials,
} from "@theone/protocol";
import { IpcError } from "../../shared/ipc-types";
import { runCommand } from "../process";
import {
  CLAUDE_MD_FILE,
  CREDENTIALS_KEY,
  EXTENSION_DIRS,
  IGNORED_DIRS,
  IMPORT_BODY_HEADROOM,
  IMPORT_SKIP_REASONS,
  KEYCHAIN,
  SETTINGS_FILE,
} from "./constants";
import { hostClaudeAccounts, readJsonObject, readOauth, type ClaudeEnvironment, type HostClaudeAccount } from "./host";
import { CLAUDE_LABELS } from "./labels";

export interface ClaudeImportOptions {
  accountId?: string;
  credentials?: boolean;
  account?: boolean;
  files?: boolean;
  keychain?: boolean;
  readKeychain?: () => Promise<string | null>;
}

export interface ClaudeImportSkip {
  path: string;
  reason: string;
}

export interface ClaudeImportPlan {
  body: ClaudeImport;
  skipped: ClaudeImportSkip[];
}

export interface ClaudeImportClient {
  importClaude(body: ClaudeImport, options?: { signal?: AbortSignal }): Promise<ClaudeImportResult>;
}

export interface ClaudeImportSummary {
  accountId: string;
  credentials: boolean;
  account: boolean;
  written: string[];
  skipped: ClaudeImportSkip[];
  loggedIn: boolean;
  importedAt: string | null;
}

async function defaultKeychainReader(): Promise<string | null> {
  const result = await runCommand(KEYCHAIN.binary, ["find-generic-password", "-s", KEYCHAIN.service, "-w"], {
    timeoutMs: KEYCHAIN.timeoutMs,
  });
  return result.code === 0 ? result.stdout.trim() : null;
}

function parseCredentials(raw: unknown): ClaudeOauthCredentials | null {
  const parsed = ClaudeOauthCredentialsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function readCredentials(
  account: HostClaudeAccount,
  environment: ClaudeEnvironment,
  options: ClaudeImportOptions,
): Promise<ClaudeOauthCredentials | null> {
  const { oauth } = await readOauth(account.paths.configDir);
  if (oauth) return parseCredentials(oauth);
  const keychainAllowed = options.keychain === true && environment.platform === "darwin" && account.primary;
  if (!keychainAllowed || environment.env.CLAUDE_CONFIG_DIR) return null;
  const raw = await (options.readKeychain ?? defaultKeychainReader)().catch(() => null);
  if (!raw) throw new IpcError("unavailable", CLAUDE_LABELS.keychainFailed);
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    return parseCredentials(data[CREDENTIALS_KEY]);
  } catch {
    throw new IpcError("unavailable", CLAUDE_LABELS.keychainFailed);
  }
}

async function readAccountKeys(account: HostClaudeAccount): Promise<Record<string, unknown> | null> {
  const config = await readJsonObject(account.paths.globalConfig);
  if (!config) return null;
  const picked: Record<string, unknown> = {};
  for (const key of CLAUDE_IMPORT_ACCOUNT_KEYS) if (key in config) picked[key] = config[key];
  return Object.keys(picked).length > 0 ? picked : null;
}

async function regularFile(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

async function walkRelative(root: string, prefix: string): Promise<string[]> {
  try {
    if (!(await lstat(root)).isDirectory()) return [];
  } catch {
    return [];
  }
  const found: string[] = [];
  const pending: [string, string][] = [[root, prefix]];
  while (pending.length > 0) {
    const [dir, relative] = pending.pop() as [string, string];
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name)) pending.push([join(dir, entry.name), path]);
      else if (entry.isFile()) found.push(path);
    }
  }
  return found.sort();
}

export async function importableFiles(configDir: string): Promise<string[]> {
  const top = [SETTINGS_FILE, CLAUDE_MD_FILE];
  const present = (await Promise.all(top.map(async (name) => ((await regularFile(join(configDir, name))) ? name : null)))).filter(
    (name): name is string => name !== null,
  );
  const nested = await Promise.all(Object.values(EXTENSION_DIRS).map((dir) => walkRelative(join(configDir, dir), dir)));
  return [...present, ...nested.flat()];
}

async function readImportFiles(configDir: string, budget: number): Promise<{ files: ClaudeImportFile[]; skipped: ClaudeImportSkip[] }> {
  const files: ClaudeImportFile[] = [];
  const skipped: ClaudeImportSkip[] = [];
  let used = 0;
  for (const path of await importableFiles(configDir)) {
    if (files.length >= LIMITS.maxClaudeImportFiles) {
      skipped.push({ path, reason: IMPORT_SKIP_REASONS.tooMany });
      continue;
    }
    let buffer: Buffer;
    try {
      buffer = await readFile(join(configDir, ...path.split("/")));
    } catch {
      skipped.push({ path, reason: IMPORT_SKIP_REASONS.unreadable });
      continue;
    }
    if (buffer.includes(0)) {
      skipped.push({ path, reason: IMPORT_SKIP_REASONS.binary });
      continue;
    }
    const content = buffer.toString("utf8");
    if (content.length > LIMITS.maxClaudeImportFileBytes) {
      skipped.push({ path, reason: IMPORT_SKIP_REASONS.tooLarge });
      continue;
    }
    const size = Buffer.byteLength(JSON.stringify(content)) + path.length;
    if (used + size > budget) {
      skipped.push({ path, reason: IMPORT_SKIP_REASONS.bodyLimit });
      continue;
    }
    used += size;
    files.push({ path, content });
  }
  return { files, skipped };
}

export async function findHostAccount(environment: ClaudeEnvironment, accountId?: string): Promise<HostClaudeAccount> {
  const accounts = await hostClaudeAccounts(environment);
  const account = accountId ? accounts.find((candidate) => candidate.id === accountId) : accounts[0];
  if (!account) throw new IpcError("not_found", CLAUDE_LABELS.unknownAccount(accountId ?? ""));
  return account;
}

export async function buildClaudeImport(environment: ClaudeEnvironment, options: ClaudeImportOptions = {}): Promise<ClaudeImportPlan> {
  const account = await findHostAccount(environment, options.accountId);
  const body: ClaudeImport = {};
  if (options.credentials !== false) {
    const credentials = await readCredentials(account, environment, options);
    if (credentials) body.credentials = credentials;
  }
  if (options.account !== false) {
    const keys = await readAccountKeys(account);
    if (keys) body.account = keys;
  }
  let skipped: ClaudeImportSkip[] = [];
  if (options.files !== false) {
    const used = Buffer.byteLength(JSON.stringify(body));
    const read = await readImportFiles(account.paths.configDir, LIMITS.maxClaudeImportBytes - IMPORT_BODY_HEADROOM - used);
    if (read.files.length > 0) body.files = read.files;
    skipped = read.skipped;
  }
  return { body, skipped };
}

export async function importHostClaude(
  environment: ClaudeEnvironment,
  client: ClaudeImportClient,
  options: ClaudeImportOptions = {},
  signal?: AbortSignal,
): Promise<ClaudeImportSummary> {
  const accountId = options.accountId ?? (await findHostAccount(environment)).id;
  const plan = await buildClaudeImport(environment, { ...options, accountId });
  if (!plan.body.credentials && !plan.body.account && !plan.body.files) {
    throw new IpcError("not_found", CLAUDE_LABELS.nothingToImport);
  }
  const result = await client.importClaude(plan.body, { signal });
  return {
    accountId,
    credentials: plan.body.credentials !== undefined,
    account: plan.body.account !== undefined,
    written: result.written,
    skipped: [...plan.skipped, ...result.skipped],
    loggedIn: result.status.loggedIn,
    importedAt: result.status.importedAt,
  };
}
