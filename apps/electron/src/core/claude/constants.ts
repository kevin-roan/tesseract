export const CLAUDE_DIR_MODE = 0o700;
export const EXTRA_ACCOUNT_PATTERN = /^\.claude-([a-z0-9][a-z0-9_-]{0,31})$/;

export const PRIMARY_ACCOUNT_ID = "claude";
export const PRIMARY_DIR_NAME = ".claude";
export const CONFIG_DIR_ENV = "CLAUDE_CONFIG_DIR";
export const CREDENTIALS_FILE = ".credentials.json";
export const CREDENTIALS_KEY = "claudeAiOauth";
export const GLOBAL_CONFIG_FILE = ".claude.json";
export const OAUTH_ACCOUNT_KEY = "oauthAccount";
export const SETTINGS_FILE = "settings.json";
export const CLAUDE_MD_FILE = "CLAUDE.md";

export const EXTENSION_DIRS = {
  skills: "skills",
  agents: "agents",
  commands: "commands",
  outputStyles: "output-styles",
} as const;

export const IGNORED_DIRS: ReadonlySet<string> = new Set([".git", ".hg", ".svn", "node_modules", "__pycache__"]);

export const KEYCHAIN = {
  binary: "/usr/bin/security",
  service: "Claude Code-credentials",
  timeoutMs: 15_000,
} as const;

export const IMPORT_BODY_HEADROOM = 64 * 1024;

export const IMPORT_SKIP_REASONS = {
  tooLarge: "larger than the import limit",
  binary: "not a text file",
  tooMany: "too many files",
  bodyLimit: "the import is too large",
  unreadable: "unreadable",
} as const;
