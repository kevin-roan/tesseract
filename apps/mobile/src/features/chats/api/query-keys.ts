import type { SessionsFilter } from "@tesseract/protocol";

export const sessionKeys = {
  lists: (sandboxId: string) => ["sandbox", sandboxId, "sessions"] as const,
  list: (sandboxId: string, filter: SessionsFilter = {}) =>
    ["sandbox", sandboxId, "sessions", { limit: filter.limit ?? null, projectId: filter.projectId ?? null }] as const,
};
