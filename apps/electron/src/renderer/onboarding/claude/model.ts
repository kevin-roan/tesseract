import type { HostClaudeSettings, HostClaudeState } from "../../../shared/contracts/claude";
import type { Tone } from "../../theme/colors";
import { SIGN_IN_COMMAND } from "./constants";
import { CLAUDE_LABELS } from "./labels";
import { capitalizePlan, formatUptime } from "./format";

export type ClaudeNoticeAction = "check" | "install-guide";

export interface ClaudeNotice {
  tone: Tone;
  title?: string;
  message: string;
  action?: ClaudeNoticeAction;
  secondaryAction?: ClaudeNoticeAction;
  command?: string;
}

export function noticeActionLabel(action: ClaudeNoticeAction): string {
  return action === "install-guide" ? CLAUDE_LABELS.openInstallGuide : CLAUDE_LABELS.checkAgain;
}

export interface ClaudeProperty {
  key: keyof typeof CLAUDE_LABELS.rows;
  title: string;
  value: string;
}

export interface ClaudeAccountView {
  id: string;
  configDir: string;
  properties: ClaudeProperty[];
}

export interface ClaudeView {
  notice: ClaudeNotice | null;
  account: ClaudeAccountView | null;
  more: string | null;
  signedIn: boolean;
}

export function primaryAccount(accounts: readonly HostClaudeState[] | null): HostClaudeState | null {
  if (!accounts?.length) return null;
  return accounts.find((account) => account.primary) ?? accounts[0] ?? null;
}

export function isFolderMissing(accounts: readonly HostClaudeState[] | null): boolean {
  return accounts !== null && !accounts.some((account) => account.primary);
}

export function nextFolderMissing(previous: boolean, accounts: readonly HostClaudeState[] | null): boolean {
  if (accounts === null) return previous;
  if (isFolderMissing(accounts)) return true;
  return previous && primaryAccount(accounts)?.login === "missing";
}

function accountValue(account: HostClaudeState): string {
  const parts = [account.email, account.organization].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : CLAUDE_LABELS.empty;
}

function tokenValue(account: HostClaudeState, nowMs: number): string {
  if (account.login !== "signed-in" || account.expiresAt === null) return CLAUDE_LABELS.empty;
  const delta = (account.expiresAt - nowMs) / 1000;
  return delta >= 0 ? CLAUDE_LABELS.expiresIn(formatUptime(delta)) : CLAUDE_LABELS.expiredAgo(formatUptime(-delta));
}

export function settingsSummary(settings: HostClaudeSettings): string {
  const parts: string[] = [];
  if (settings.settingsJson) parts.push(CLAUDE_LABELS.settingsJson);
  if (settings.claudeMd) parts.push(CLAUDE_LABELS.claudeMd);
  for (const key of ["skills", "agents", "commands", "outputStyles"] as const) {
    const count = settings[key];
    if (count > 0) {
      const [one, many] = CLAUDE_LABELS.files[key];
      parts.push(`${count} ${count === 1 ? one : many}`);
    }
  }
  return parts.length ? parts.join(" · ") : CLAUDE_LABELS.noSettings;
}

export function accountView(account: HostClaudeState, nowMs: number): ClaudeAccountView {
  const rows = CLAUDE_LABELS.rows;
  return {
    id: account.id,
    configDir: account.configDir,
    properties: [
      {
        key: "login",
        title: rows.login,
        value: CLAUDE_LABELS.login[account.login],
      },
      { key: "account", title: rows.account, value: accountValue(account) },
      {
        key: "plan",
        title: rows.plan,
        value: account.subscriptionType ? capitalizePlan(account.subscriptionType) : CLAUDE_LABELS.empty,
      },
      {
        key: "accessToken",
        title: rows.accessToken,
        value: tokenValue(account, nowMs),
      },
      {
        key: "settings",
        title: rows.settings,
        value: settingsSummary(account.settings),
      },
    ],
  };
}

export function claudeNotice(account: HostClaudeState | null, folderMissing: boolean): ClaudeNotice | null {
  if (folderMissing || !account) {
    return {
      tone: "warning",
      title: CLAUDE_LABELS.folderMissingTitle,
      message: CLAUDE_LABELS.folderMissingMessage,
      action: "install-guide",
      secondaryAction: "check",
    };
  }
  switch (account.login) {
    case "signed-in":
      return {
        tone: "success",
        message: account.email ? CLAUDE_LABELS.signedInAs(account.email) : CLAUDE_LABELS.signedIn,
      };
    case "keychain":
      return {
        tone: "info",
        title: CLAUDE_LABELS.keychainTitle,
        message: CLAUDE_LABELS.keychainMessage,
      };
    default:
      return {
        tone: "warning",
        title: CLAUDE_LABELS.notSignedInTitle,
        message: CLAUDE_LABELS.notSignedInMessage,
        action: "check",
        command: SIGN_IN_COMMAND,
      };
  }
}

export function claudeView(
  accounts: readonly HostClaudeState[] | null,
  folderMissing: boolean,
  nowMs: number,
): ClaudeView {
  if (accounts === null) return { notice: null, account: null, more: null, signedIn: false };
  const primary = primaryAccount(accounts);
  const others = accounts.length - (primary ? 1 : 0);
  return {
    notice: claudeNotice(primary, folderMissing),
    account: primary ? accountView(primary, nowMs) : null,
    more: others > 0 ? CLAUDE_LABELS.moreAccounts(others) : null,
    signedIn: primary?.login === "signed-in",
  };
}
