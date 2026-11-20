import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLAUDE_OAUTH_TOKEN_PATTERN, CLAUDE_TOKEN_ACCOUNT_ID, type ClaudeAccountList, type ClaudeAccountProfile } from "@tesseract/protocol";
import type { ClaudeAccountDir, Config } from "../config";
import { badRequest, notFound, unavailable } from "../core/errors";
import type { Env } from "../core/exec";
import type { Repositories } from "../db/repositories";
import { nowIso } from "../core/time";
import { expiresAtIso, isObject, mapAccount, readJson, text } from "./claude-auth";

export type ClaudeAccountResolver = Pick<ClaudeAccountService, "resolve">;

export const DEFAULT_ACCOUNT_SETTING = "claude.defaultAccount";

/** The long-lived token of the `claude-token` account, in the data dir (0600). */
export const CLAUDE_TOKEN_FILE = "claude-oauth-token";

/** Credentials Claude Code prefers over its config dir's login; they belong to the primary account. */
export const CLAUDE_ENV_CREDENTIALS = ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"] as const;

/** `base` set up for `account`: another account's dir must log in with its own credentials, not the primary's env token. */
export function claudeAccountEnv(account: ClaudeAccountDir, base: Env): Env {
  if (Object.keys(account.env).length === 0) return base;
  const env = { ...base };
  for (const name of CLAUDE_ENV_CREDENTIALS) delete env[name];
  return { ...env, ...account.env };
}

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/**
 * The host's Claude Code config dirs linked into the sandbox, plus the `claude-token` account when a long-lived
 * token is stored (the primary's dir, signed in with that token), and which one each project runs with.
 */
export class ClaudeAccountService {
  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
  ) {}

  get primary(): ClaudeAccountDir {
    return this.config.claudeAccounts[0]!;
  }

  private get tokenFile(): string {
    return join(this.config.dataDir, CLAUDE_TOKEN_FILE);
  }

  /** The stored long-lived token, or null. */
  private token(): string | null {
    try {
      const token = readFileSync(this.tokenFile, "utf8").trim();
      return CLAUDE_OAUTH_TOKEN_PATTERN.test(token) ? token : null;
    } catch {
      return null;
    }
  }

  /** The `claude-token` account: the primary's config dir (settings, CLAUDE.md, sessions) with the token instead of its login. */
  private tokenAccount(): ClaudeAccountDir | null {
    const token = this.token();
    if (token === null || this.config.claudeAccounts.some((account) => account.id === CLAUDE_TOKEN_ACCOUNT_ID)) return null;
    const { configDir, globalConfig } = this.primary;
    // No CLAUDE_CONFIG_DIR: setting it would move the global config from `~/.claude.json` into the dir.
    return { id: CLAUDE_TOKEN_ACCOUNT_ID, configDir, globalConfig, env: { CLAUDE_CODE_OAUTH_TOKEN: token } };
  }

  /** Configured accounts, then the token account. */
  accounts(): ClaudeAccountDir[] {
    const token = this.tokenAccount();
    return token ? [...this.config.claudeAccounts, token] : this.config.claudeAccounts;
  }

  find(id: string): ClaudeAccountDir | null {
    return this.accounts().find((account) => account.id === id) ?? null;
  }

  /** Accounts on the primary's dir (the primary and the token account) work before Claude creates it. */
  private sharesPrimaryDir(account: ClaudeAccountDir): boolean {
    return account.configDir === this.primary.configDir;
  }

  present(account: ClaudeAccountDir): boolean {
    return isDirectory(account.configDir);
  }

  /** Stores the long-lived token (`claude setup-token`); the `claude-token` account appears in the list. */
  setToken(token: string): ClaudeAccountList {
    if (!CLAUDE_OAUTH_TOKEN_PATTERN.test(token)) throw badRequest("The Claude token must be printable ASCII without spaces");
    mkdirSync(this.config.dataDir, { recursive: true, mode: 0o700 });
    const temp = `${this.tokenFile}.${process.pid}.tmp`;
    writeFileSync(temp, `${token}\n`, { mode: 0o600 });
    chmodSync(temp, 0o600);
    renameSync(temp, this.tokenFile);
    return this.list();
  }

  /** Forgets the token; the default falls back to the primary when it was the token account. */
  clearToken(): ClaudeAccountList {
    rmSync(this.tokenFile, { force: true });
    if (this.repos.setting(DEFAULT_ACCOUNT_SETTING) === CLAUDE_TOKEN_ACCOUNT_ID) this.repos.deleteSetting(DEFAULT_ACCOUNT_SETTING);
    return this.list();
  }

  defaultId(): string {
    const stored = this.repos.setting(DEFAULT_ACCOUNT_SETTING);
    return stored !== null && this.find(stored) ? stored : this.primary.id;
  }

  list(): ClaudeAccountList {
    return { defaultAccountId: this.defaultId(), accounts: this.accounts().map((account) => this.profile(account)) };
  }

  setDefault(id: string): ClaudeAccountList {
    this.requireUsable(id);
    this.repos.saveSetting(DEFAULT_ACCOUNT_SETTING, id, nowIso());
    return this.list();
  }

  /** Throws unless `id` is a configured account whose dir is linked into the sandbox (Claude creates the primary one itself). */
  requireUsable(id: string): ClaudeAccountDir {
    const account = this.find(id);
    if (!account) throw notFound(`Claude account ${id} not found`);
    if (!this.sharesPrimaryDir(account) && !this.present(account)) throw badRequest(`Claude account ${id} is not linked into the sandbox (${account.configDir} is missing)`);
    return account;
  }

  /** Id of the account `projectId` runs with: the project's pick, else the default. */
  selectedId(projectId: string | null): string {
    return (projectId === null ? null : this.repos.projectClaudeAccount(projectId)) ?? this.defaultId();
  }

  /**
   * The account a new Claude process uses: the project's, else the default. A resumed session whose
   * transcript lives in another account's dir is moved there first, so switching accounts carries the chat over.
   */
  resolve(projectId: string | null, sessionId?: string): ClaudeAccountDir {
    const id = this.selectedId(projectId);
    const account = this.find(id);
    if (!account) throw unavailable(`Claude account ${id} is no longer configured: pick another account for this project`);
    if (!this.sharesPrimaryDir(account) && !this.present(account)) throw unavailable(`Claude account ${id} is not linked into the sandbox (${account.configDir} is missing)`);
    if (sessionId !== undefined) this.moveSession(sessionId, account);
    return account;
  }

  /** Moves `<dir>/projects/<cwd>/<sessionId>.jsonl` (and its `<sessionId>/` subagent dir) into `target`'s config dir. */
  private moveSession(sessionId: string, target: ClaudeAccountDir): void {
    const file = `${sessionId}.jsonl`;
    for (const account of this.config.claudeAccounts) {
      if (account.configDir === target.configDir) continue;
      const projects = join(account.configDir, "projects");
      let dirs: string[];
      try {
        dirs = readdirSync(projects);
      } catch {
        continue;
      }
      for (const dir of dirs) {
        const from = join(projects, dir);
        if (!existsSync(join(from, file))) continue;
        const to = join(target.configDir, "projects", dir);
        if (existsSync(join(to, file))) return;
        try {
          mkdirSync(to, { recursive: true });
          for (const name of [file, sessionId]) {
            if (!existsSync(join(from, name))) continue;
            cpSync(join(from, name), join(to, name), { recursive: true, preserveTimestamps: true });
            rmSync(join(from, name), { recursive: true, force: true });
          }
        } catch (error) {
          throw unavailable(`Could not move Claude session ${sessionId} to account ${target.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
        return;
      }
    }
  }

  private profile(account: ClaudeAccountDir): ClaudeAccountProfile {
    if (account.id === CLAUDE_TOKEN_ACCOUNT_ID && account.env.CLAUDE_CODE_OAUTH_TOKEN) {
      const present = this.present(account);
      return {
        id: account.id,
        kind: "token",
        primary: false,
        present: true,
        loggedIn: true,
        account: null,
        subscriptionType: null,
        credentialsExpiresAt: null,
        settingsPresent: present && existsSync(join(account.configDir, "settings.json")),
        configDir: account.configDir,
      };
    }
    const present = this.present(account);
    const credentials = present ? readJson(join(account.configDir, ".credentials.json")).value : null;
    const oauth = isObject(credentials?.claudeAiOauth) ? credentials.claudeAiOauth : null;
    const loggedIn = text(oauth?.accessToken) !== null;
    return {
      id: account.id,
      kind: "config_dir",
      primary: account === this.primary,
      present,
      loggedIn,
      account: present ? mapAccount(readJson(account.globalConfig).value?.oauthAccount) : null,
      subscriptionType: loggedIn ? text(oauth?.subscriptionType) : null,
      credentialsExpiresAt: loggedIn ? expiresAtIso(oauth?.expiresAt) : null,
      settingsPresent: present && existsSync(join(account.configDir, "settings.json")),
      configDir: account.configDir,
    };
  }
}
