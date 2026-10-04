import { isApiError } from "@theone/client";
import type { ClaudeAccountList, ClaudeAccountProfile } from "@theone/protocol";

import type { MenuOption } from "@/components/menu-sheet";
import { capitalize, pluralize } from "@/features/sandbox/utils/format";

export const DEFAULT_ACCOUNT_CHOICE = "default";

export const CLAUDE_ACCOUNTS_COPY = {
  screenTitle: "Claude accounts",
  screenSubtitle: "Which Claude Code login the sandbox uses",
  accountsTitle: "Accounts",
  accountsFootnote: "Tap an account to make it the default. A project can pick its own account.",
  accountsLoading: "Loading Claude accounts…",
  accountsFailed: "Couldn't load the Claude accounts",
  statusTitle: "Primary sign-in",
  statusLoading: "Checking Claude sign-in…",
  statusFailed: "Couldn't check the Claude sign-in",
  retry: "Try again",
  unsupported: "This sandbox can't switch Claude accounts yet. Update the sandbox to pick an account.",
  hostTitle: "Credentials come from the host",
  hostMessage:
    "Each account is a Claude Code config folder on the host machine (~/.claude, ~/.claude-<name>) linked into the sandbox. Log in on the host with claude, claude-work and so on, then pull to refresh. Switching here never changes the host's login.",
  defaultValue: "Default",
  switching: "Switching…",
  saving: "Saving…",
  notLinked: "Not linked into the sandbox",
  notSignedIn: "Not signed in",
  signedIn: "Signed in",
  projectSection: "Claude",
  projectRow: "Claude account",
  projectSheetFootnote: "Claude runs and sessions in this project sign in with this account.",
  profileTitle: "Claude accounts",
  profileSwitch: "Switch accounts",
} as const;

export type ClaudeAccountRowView = {
  id: string;
  label: string;
  detail: string;
  value?: string;
  selected: boolean;
  disabled: boolean;
};

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

export const isClaudeAccountsUnsupported = (error: unknown): boolean => isApiError(error, "not_found");

export const findClaudeAccount = (list: ClaudeAccountList, id: string): ClaudeAccountProfile | undefined =>
  list.accounts.find((account) => account.id === id);

export function claudeAccountDetail(profile: ClaudeAccountProfile): string {
  if (!profile.present) return CLAUDE_ACCOUNTS_COPY.notLinked;
  if (!profile.loggedIn) return CLAUDE_ACCOUNTS_COPY.notSignedIn;
  const { account, subscriptionType } = profile;
  return (
    join([
      account?.email ?? account?.displayName,
      account?.organization,
      subscriptionType ? capitalize(subscriptionType) : null,
    ]) || CLAUDE_ACCOUNTS_COPY.signedIn
  );
}

export function claudeAccountRows(list: ClaudeAccountList, pendingId: string | null): ClaudeAccountRowView[] {
  const selectedId = pendingId ?? list.defaultAccountId;
  return list.accounts.map((profile) => ({
    id: profile.id,
    label: profile.id,
    detail: join([claudeAccountDetail(profile), profile.configDir]),
    value:
      profile.id === pendingId
        ? CLAUDE_ACCOUNTS_COPY.switching
        : profile.id === list.defaultAccountId
          ? CLAUDE_ACCOUNTS_COPY.defaultValue
          : undefined,
    selected: profile.id === selectedId,
    disabled: !profile.present,
  }));
}

export function claudeAccountsSummary(list: ClaudeAccountList): string {
  const profile = findClaudeAccount(list, list.defaultAccountId);
  const current = profile?.account?.email ?? list.defaultAccountId;
  if (list.accounts.length < 2) return current;
  return join([current, `${CLAUDE_ACCOUNTS_COPY.profileSwitch} (${pluralize(list.accounts.length, "account")})`]);
}

export const projectAccountChoice = (accountId: string | null): string => accountId ?? DEFAULT_ACCOUNT_CHOICE;

export const accountIdForChoice = (choice: string): string | null =>
  choice === DEFAULT_ACCOUNT_CHOICE ? null : choice;

const defaultChoiceLabel = (list: ClaudeAccountList) => `${CLAUDE_ACCOUNTS_COPY.defaultValue} (${list.defaultAccountId})`;

export function projectAccountOptions(list: ClaudeAccountList): MenuOption[] {
  const fallback = findClaudeAccount(list, list.defaultAccountId);
  return [
    {
      id: DEFAULT_ACCOUNT_CHOICE,
      label: defaultChoiceLabel(list),
      description: fallback ? claudeAccountDetail(fallback) : undefined,
    },
    ...list.accounts.map((profile) => ({
      id: profile.id,
      label: profile.id,
      description: claudeAccountDetail(profile),
      disabled: !profile.present,
    })),
  ];
}

export function projectAccountSummary(accountId: string | null, list: ClaudeAccountList | undefined): string {
  if (!list) return accountId ?? CLAUDE_ACCOUNTS_COPY.defaultValue;
  const profile = findClaudeAccount(list, accountId ?? list.defaultAccountId);
  return join([accountId ?? defaultChoiceLabel(list), profile ? claudeAccountDetail(profile) : null]);
}
