import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ClaudeAccountList, ClaudeAccountProfile } from "@tesseract/protocol";
import type { ClaudeAccountDir, Config } from "../config";
import { badRequest, notFound, unavailable } from "../core/errors";
import type { Env } from "../core/exec";
import type { Repositories } from "../db/repositories";
import { nowIso } from "../core/time";
import { expiresAtIso, isObject, mapAccount, readJson, text } from "./claude-auth";

export type ClaudeAccountResolver = Pick<ClaudeAccountService, "resolve">;

export const DEFAULT_ACCOUNT_SETTING = "claude.defaultAccount";

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

/** The host's Claude Code config dirs linked into the sandbox, and which one each project runs with. */
export class ClaudeAccountService {
  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
  ) {}

  get primary(): ClaudeAccountDir {
    return this.config.claudeAccounts[0]!;
  }

  find(id: string): ClaudeAccountDir | null {
    return this.config.claudeAccounts.find((account) => account.id === id) ?? null;
  }

  present(account: ClaudeAccountDir): boolean {
    return isDirectory(account.configDir);
  }

  defaultId(): string {
    const stored = this.repos.setting(DEFAULT_ACCOUNT_SETTING);
    return stored !== null && this.find(stored) ? stored : this.primary.id;
  }

  list(): ClaudeAccountList {
    return { defaultAccountId: this.defaultId(), accounts: this.config.claudeAccounts.map((account) => this.profile(account)) };
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
    if (account !== this.primary && !this.present(account)) throw badRequest(`Claude account ${id} is not linked into the sandbox (${account.configDir} is missing)`);
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
    if (account !== this.primary && !this.present(account)) throw unavailable(`Claude account ${id} is not linked into the sandbox (${account.configDir} is missing)`);
    if (sessionId !== undefined) this.moveSession(sessionId, account);
    return account;
  }

  /** Moves `<dir>/projects/<cwd>/<sessionId>.jsonl` (and its `<sessionId>/` subagent dir) into `target`'s config dir. */
  private moveSession(sessionId: string, target: ClaudeAccountDir): void {
    const file = `${sessionId}.jsonl`;
    for (const account of this.config.claudeAccounts) {
      if (account === target) continue;
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
    const present = this.present(account);
    const credentials = present ? readJson(join(account.configDir, ".credentials.json")).value : null;
    const oauth = isObject(credentials?.claudeAiOauth) ? credentials.claudeAiOauth : null;
    const loggedIn = text(oauth?.accessToken) !== null;
    return {
      id: account.id,
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
