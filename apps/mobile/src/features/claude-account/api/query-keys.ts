export const claudeKeys = {
  auth: (sandboxId: string) => ["sandbox", sandboxId, "claude", "auth"] as const,
};
