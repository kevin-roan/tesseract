import type { AppRunFilter } from "@tesseract/protocol";

const filterKey = (filter?: AppRunFilter): AppRunFilter => (filter?.projectId ? { projectId: filter.projectId } : {});

export const appRunKeys = {
  targets: (sandboxId: string, projectId: string) => ["sandbox", sandboxId, "run-targets", projectId] as const,
  lists: (sandboxId: string) => ["sandbox", sandboxId, "app-runs"] as const,
  list: (sandboxId: string, filter?: AppRunFilter) => ["sandbox", sandboxId, "app-runs", filterKey(filter)] as const,
  detail: (sandboxId: string, runId: string) => ["sandbox", sandboxId, "app-run", runId] as const,
};
