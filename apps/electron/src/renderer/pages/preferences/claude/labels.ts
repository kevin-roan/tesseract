import type { ClaudeAuthMethod } from "@tesseract/protocol";
import type { HostClaudeLogin } from "../../../../shared/contracts/claude";

export const SECTION_LABELS = {
  title: "Claude",
  hostGroup: "This computer",
  hostDescription: "Claude Code accounts on this machine (~/.claude and ~/.claude-<name>)",
  sandboxGroup: "Sandbox",
  sandboxDescription: "Claude Code inside the sandbox uses this computer's ~/.claude folders (linked)",
  accountsGroup: "Accounts",
  accountsDescription: "Accounts linked into the sandbox, and the long-lived token. The default is used by projects that don't pick one.",
  tokenAccount: "Long-lived token",
  primary: "primary",
  accountAbsent: "Not linked into the sandbox",
  accountsEmpty: "No accounts",
  login: "Login",
  account: "Account",
  plan: "Plan",
  tokenExpiry: "Access token",
  settings: "Settings",
  loggedIn: "Signed in",
  notLoggedIn: "Not signed in",
  expiresIn: (duration: string) => `Expires in ${duration}`,
  expired: (duration: string) => `Expired ${duration} ago · Claude Code refreshes it on next use`,
  settingsNone: "No settings found",
  settingsJson: "settings.json",
  claudeMd: "CLAUDE.md",
  skills: "skill file",
  agents: "agent file",
  commands: "command file",
  outputStyles: "output style file",
  unavailable: "Claude Code is not installed in the sandbox",
  settingsPresent: "settings.json present",
  settingsMissing: "No settings.json",
  outdated:
    "This sandbox is too old for Claude sign-in. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`.",
  accountsOutdated:
    "This sandbox is too old for multiple Claude accounts. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`.",
} as const;

export const LOGIN_LABELS: Record<HostClaudeLogin, string> = {
  "signed-in": "Signed in",
  missing: "Login not found",
  invalid: "Login file is unreadable",
  keychain: "Login not found (macOS keychain not supported)",
};

export const METHOD_LABELS: Record<ClaudeAuthMethod, string> = {
  oauth_token: "Signed in with a long-lived token",
  credentials: "Signed in with this computer's login",
  api_key: "Using an API key",
  none: "Not signed in",
};

export const METHOD_OAUTH_ENV = "Signed in with a long-lived token from the environment";

export const TOKEN_LABELS = {
  title: "Long-lived token",
  description:
    "A token from claude setup-token, saved in the sandbox as the claude-token account. It sits next to the linked ~/.claude accounts: pick it below as the default, or per project, and switch back any time.",
  token: "Token",
  placeholder: "sk-ant-oat01-…",
  help: "Run claude setup-token on any machine signed in to the account you want, then paste the token here.",
  configured: "A token is saved. Paste a new one to replace it.",
  missing: "No token. Claude uses the linked accounts only.",
  badge: { saved: "Saved", missing: "Not set" },
  save: "Save",
  clear: "Remove token",
} as const;

export const CLAUDE_TOASTS = {
  defaultChanged: (id: string) => `Default Claude account set to ${id}`,
  defaultFailed: (error: string) => `Couldn't change the default Claude account: ${error}`,
  tokenSaved: "Claude token saved as the claude-token account",
  tokenCleared: "Claude token removed",
  tokenFailed: (error: string) => `Couldn't save the Claude token: ${error}`,
  tokenClearFailed: (error: string) => `Couldn't remove the Claude token: ${error}`,
} as const;
