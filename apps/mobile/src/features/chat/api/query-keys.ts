export const chatKeys = {
  claudeCommands: (sandboxId: string, projectId: string | null) =>
    ["sandbox", sandboxId, "claude", "commands", projectId ? { projectId } : {}] as const,
};
