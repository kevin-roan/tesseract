export const inboxKeys = {
  list: (sandboxId: string) => ["sandbox", sandboxId, "inbox"] as const,
};
