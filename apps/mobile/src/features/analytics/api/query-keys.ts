import { sandboxKeys } from "@/features/sandbox/api/query-keys";

export const analyticsKeys = {
  usage: (sandboxId: string, days: number) => [...sandboxKeys.all(sandboxId), "usage", days] as const,
  sessions: (sandboxId: string, projectId: string | null) =>
    [...sandboxKeys.all(sandboxId), "sessions", projectId ? { projectId } : {}] as const,
};
