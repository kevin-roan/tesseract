export const CLAUDE_LABELS = {
  notADirectory: (path: string) => `${path} exists but is not a folder`,
  unknownAccount: (id: string) => `No Claude Code account "${id}" on this computer`,
  nothingToImport: "Nothing to import from this computer's Claude Code login",
  keychainFailed: "Couldn't read the Claude Code login from the macOS keychain",
} as const;
