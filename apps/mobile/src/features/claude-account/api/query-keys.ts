export const claudeKeys = {
  auth: (sandboxId: string) => ["sandbox", sandboxId, "claude", "auth"] as const,
  accounts: (sandboxId: string) => ["sandbox", sandboxId, "claude", "accounts"] as const,
};
