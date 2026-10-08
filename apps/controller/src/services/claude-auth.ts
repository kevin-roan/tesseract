import { chmodSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, realpathSync, rmSync, type Stats } from "node:fs";
import { isAbsolute, join, posix } from "node:path";
import {
  CLAUDE_IMPORT_ACCOUNT_KEYS,
  CLAUDE_IMPORT_DROPPED_SETTINGS,
  CLAUDE_IMPORT_PATHS,
  type ClaudeAccount,
  type ClaudeAuthMethod,
  type ClaudeAuthStatus,
  type ClaudeImport,
  type ClaudeImportFile,
  type ClaudeImportResult,
} from "@tesseract/protocol";
import type { Config } from "../config";
import { resolveExecutable } from "../core/exec";
import { readRegularFile, writeFileAtomic } from "../core/files";
import type { Logger } from "../core/logger";
import { isInside, realpathOrNull } from "../core/paths";
import { nowIso } from "../core/time";

export const CLAUDE_IMPORT_STATE_FILE = "claude-import.json";
export const BACKUP_SUFFIX = ".tesseract-bak";

type Json = Record<string, unknown>;
type Skipped = ClaudeImportResult["skipped"][number];

const SECRET_MODE = 0o600;
const FILE_MODE = 0o644;
const DIR_MODE = 0o700;
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const ACCOUNT_KEYS: ReadonlySet<string> = new Set(CLAUDE_IMPORT_ACCOUNT_KEYS);
const DROPPED_SETTINGS: ReadonlySet<string> = new Set(CLAUDE_IMPORT_DROPPED_SETTINGS);

export const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
export const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

export function readJson(path: string): { exists: boolean; value: Json | null } {
  if (!existsSync(path)) return { exists: false, value: null };
  const file = readRegularFile(path, { maxBytes: MAX_JSON_BYTES, followSymlinks: true });
  if (!file) return { exists: true, value: null };
  try {
    const value: unknown = JSON.parse(file.content);
    return { exists: true, value: isObject(value) ? value : null };
  } catch {
    return { exists: true, value: null };
  }
}

export function mapAccount(value: unknown): ClaudeAccount | null {
  if (!isObject(value)) return null;
  return { email: text(value.emailAddress), displayName: text(value.displayName), organization: text(value.organizationName) };
}

export function expiresAtIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Why an import path is refused, or null when it is a normalized relative path listed in `CLAUDE_IMPORT_PATHS`. */
export function importPathError(path: string): string | null {
  if (path.includes("\0") || path.includes("\\")) return "invalid characters";
  if (isAbsolute(path)) return "absolute path";
  const segments = path.split("/");
  if (segments.some((segment) => segment === "..")) return "path traversal";
  if (posix.normalize(path) !== path || segments.some((segment) => segment === "" || segment === ".")) return "path is not normalized";
  const allowed = CLAUDE_IMPORT_PATHS.some((entry) => (entry.endsWith("/") ? path.startsWith(entry) && path.length > entry.length : path === entry));
  return allowed ? null : "not an importable path";
}

/** `settings.json` without the keys that run host commands; null when it is not a JSON object. */
export function sanitizeSettings(content: string): { settings: Json; dropped: string[] } | null {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return null;
  }
  if (!isObject(value)) return null;
  const settings: Json = {};
  const dropped: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (DROPPED_SETTINGS.has(key)) dropped.push(key);
    else settings[key] = entry;
  }
  return { settings, dropped };
}

function lstatOrNull(path: string): Stats | null {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

const json = (value: Json) => `${JSON.stringify(value, null, 2)}\n`;

export class ClaudeAuthService {
  constructor(
    private readonly config: Config,
    private readonly logger: Logger,
  ) {}

  /** How the global config is named in `written`/`skipped`: relative to the config dir, or `~/.claude.json`. */
  get globalConfigLabel(): string {
    return this.config.claudeGlobalConfig === join(this.config.claudeConfigDir, ".claude.json") ? ".claude.json" : "~/.claude.json";
  }

  status(): ClaudeAuthStatus {
    const { config } = this;
    const credentials = readJson(join(config.claudeConfigDir, ".credentials.json")).value;
    const oauth = isObject(credentials?.claudeAiOauth) ? credentials.claudeAiOauth : null;
    const sources = {
      oauthToken: config.claudeEnvAuth.oauthToken,
      credentials: text(oauth?.accessToken) !== null,
      apiKey: config.claudeEnvAuth.apiKey,
    };
    const method: ClaudeAuthMethod = sources.oauthToken ? "oauth_token" : sources.credentials ? "credentials" : sources.apiKey ? "api_key" : "none";
    return {
      available: resolveExecutable(config.claudeBin) !== null,
      method,
      loggedIn: method !== "none",
      sources,
      oauthTokenFromEnv: config.claudeEnvAuth.oauthToken,
      account: mapAccount(readJson(config.claudeGlobalConfig).value?.oauthAccount),
      subscriptionType: sources.credentials ? text(oauth?.subscriptionType) : null,
      credentialsExpiresAt: sources.credentials ? expiresAtIso(oauth?.expiresAt) : null,
      settingsPresent: existsSync(join(config.claudeConfigDir, "settings.json")),
      configDir: config.claudeConfigDir,
      importedAt: this.importedAt(),
    };
  }

  import(input: ClaudeImport): ClaudeImportResult {
    const written: string[] = [];
    const skipped: Skipped[] = [];
    mkdirSync(this.config.claudeConfigDir, { recursive: true, mode: DIR_MODE });

    if (input.credentials) {
      const path = join(this.config.claudeConfigDir, ".credentials.json");
      const existing = readJson(path).value ?? {};
      this.replace(path, json({ ...existing, claudeAiOauth: input.credentials }), SECRET_MODE);
      written.push(".credentials.json");
    }

    if (input.account) this.importAccount(input.account, written, skipped);

    for (const file of input.files ?? []) this.importFile(file, written, skipped);

    this.writeImportedAt();
    this.logger.info("imported Claude Code config", { written: written.length, skipped: skipped.length });
    return { status: this.status(), written, skipped };
  }

  private importAccount(account: Json, written: string[], skipped: Skipped[]): void {
    const label = this.globalConfigLabel;
    const accepted: Json = {};
    for (const [key, value] of Object.entries(account)) {
      if (ACCOUNT_KEYS.has(key)) accepted[key] = value;
      else skipped.push({ path: `${label}#${key}`, reason: "not an importable account key" });
    }
    if (Object.keys(accepted).length === 0) return;
    const current = readJson(this.config.claudeGlobalConfig);
    if (current.exists && current.value === null) {
      skipped.push({ path: label, reason: "the existing file is not a JSON object" });
      return;
    }
    this.replace(this.config.claudeGlobalConfig, json({ ...current.value, ...accepted }), SECRET_MODE);
    written.push(label);
  }

  private importFile(file: ClaudeImportFile, written: string[], skipped: Skipped[]): void {
    const pathError = importPathError(file.path);
    if (pathError) {
      skipped.push({ path: file.path, reason: pathError });
      return;
    }
    let content = file.content;
    let mode = FILE_MODE;
    if (file.path === "settings.json") {
      const sanitized = sanitizeSettings(file.content);
      if (!sanitized) {
        skipped.push({ path: file.path, reason: "not a JSON object" });
        return;
      }
      for (const key of sanitized.dropped) skipped.push({ path: `settings.json#${key}`, reason: "runs host commands or points at host paths" });
      content = json(sanitized.settings);
      mode = SECRET_MODE;
    }
    try {
      const target = this.prepareTarget(file.path);
      if (typeof target !== "string") {
        skipped.push({ path: file.path, reason: target.error });
        return;
      }
      if (file.path === "settings.json") this.replace(target, content, mode);
      else writeFileAtomic(target, content, mode);
      written.push(file.path);
    } catch (error) {
      this.logger.warn("could not write an imported Claude file", { path: file.path, error });
      skipped.push({ path: file.path, reason: "write failed" });
    }
  }

  /**
   * Creates the parent directories of `relPath` under the config dir. Every existing component
   * must resolve (through symlinks) inside the config dir; the final entry must not be a directory.
   */
  private prepareTarget(relPath: string): string | { error: string } {
    const root = realpathSync(this.config.claudeConfigDir);
    const segments = relPath.split("/");
    let dir = root;
    for (const segment of segments.slice(0, -1)) {
      const next = join(dir, segment);
      const stats = lstatOrNull(next);
      if (!stats) {
        mkdirSync(next, { mode: DIR_MODE });
        dir = next;
      } else if (stats.isSymbolicLink()) {
        const real = realpathOrNull(next);
        if (!real) return { error: "broken symlink" };
        if (!isInside(root, real)) return { error: "symlink leaves the config dir" };
        if (!lstatOrNull(real)?.isDirectory()) return { error: "parent is not a directory" };
        dir = real;
      } else if (stats.isDirectory()) {
        dir = next;
      } else {
        return { error: "parent is not a directory" };
      }
    }
    const target = join(dir, segments.at(-1) ?? "");
    const existing = lstatOrNull(target);
    if (existing && !existing.isFile() && !existing.isSymbolicLink()) return { error: "target is not a regular file" };
    return target;
  }

  /** Atomic write that first copies the previous file to `<file>.tesseract-bak`. */
  private replace(path: string, content: string, mode: number): void {
    if (existsSync(path)) {
      const backup = `${path}${BACKUP_SUFFIX}`;
      try {
        rmSync(backup, { force: true });
        copyFileSync(path, backup, constants.COPYFILE_EXCL);
        chmodSync(backup, mode);
      } catch (error) {
        this.logger.warn("could not back up a Claude file before the import", { path, error });
      }
    }
    writeFileAtomic(path, content, mode);
  }

  private get stateFile(): string {
    return join(this.config.dataDir, CLAUDE_IMPORT_STATE_FILE);
  }

  private importedAt(): string | null {
    return text(readJson(this.stateFile).value?.importedAt);
  }

  private writeImportedAt(): void {
    writeFileAtomic(this.stateFile, json({ importedAt: nowIso() }), SECRET_MODE);
  }
}
