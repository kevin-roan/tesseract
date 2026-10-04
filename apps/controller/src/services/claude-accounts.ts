import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ClaudeAccountList, ClaudeAccountProfile } from "@theone/protocol";
import type { ClaudeAccountDir, Config } from "../config";
import { badRequest, notFound, unavailable } from "../core/errors";
import type { Repositories } from "../db/repositories";
import { nowIso } from "../core/time";
import { expiresAtIso, isObject, mapAccount, readJson, text } from "./claude-auth";

export type ClaudeAccountResolver = Pick<ClaudeAccountService, "resolve">;

export const DEFAULT_ACCOUNT_SETTING = "claude.defaultAccount";

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

  /** The account a new Claude process uses: the session's, else the project's, else the default. */
  resolve(projectId: string | null, sessionId?: string): ClaudeAccountDir {
    const pinned = sessionId === undefined ? null : this.repos.sessionClaudeAccount(sessionId);
    const id = pinned ?? (projectId === null ? null : this.repos.projectClaudeAccount(projectId)) ?? this.defaultId();
    const account = this.find(id);
    if (!account) throw unavailable(`Claude account ${id} is no longer configured: pick another account for this project`);
    if (account !== this.primary && !this.present(account)) throw unavailable(`Claude account ${id} is not linked into the sandbox (${account.configDir} is missing)`);
    return account;
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
