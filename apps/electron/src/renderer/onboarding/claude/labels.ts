export const CLAUDE_LABELS = {
  description:
    "The sandbox uses this computer's Claude Code login: the folder ~/.claude is shared with it, never copied.",
  group: "This computer",
  checkAgain: "Check again",
  openInstallGuide: "Open install guide",
  moreAccounts: (count: number) => (count === 1 ? "1 more account" : `${count} more accounts`),
  signedInAs: (email: string) => `Signed in as ${email}`,
  signedIn: "Signed in",
  folderMissingTitle: "Claude Code isn't set up on this computer",
  folderMissingMessage:
    "Install Claude Code and sign in once with your Claude subscription, then check again. Tesseract creates an empty ~/.claude now so the sandbox can start.",
  notSignedInTitle: "Not signed in",
  notSignedInMessage:
    "Run claude in a terminal and sign in, then check again. You can also sign in later from the sandbox.",
  keychainTitle: "Signed in through the macOS keychain",
  keychainMessage:
    "The sandbox can't read the keychain. After the build, open a sandbox terminal and run claude once to sign in there; the login is saved in ~/.claude for both.",
  checkFailed: (error: string) => `Couldn't read the Claude Code login: ${error}`,
  loading: "Reading the Claude Code login…",
  rows: {
    login: "Login",
    account: "Account",
    plan: "Plan",
    accessToken: "Access token",
    settings: "Settings",
  },
  login: {
    "signed-in": "Signed in",
    missing: "Login not found",
    invalid: "Login file is unreadable",
    keychain: "Login not found (macOS keychain not supported)",
  },
  empty: "—",
  expiresIn: (duration: string) => `Expires in ${duration}`,
  expiredAgo: (duration: string) => `Expired ${duration} ago · Claude Code refreshes it on next use`,
  settingsJson: "settings.json",
  claudeMd: "CLAUDE.md",
  files: {
    skills: ["skill file", "skill files"],
    agents: ["agent file", "agent files"],
    commands: ["command file", "command files"],
    outputStyles: ["output style file", "output style files"],
  },
  noSettings: "No settings found",
} as const;
