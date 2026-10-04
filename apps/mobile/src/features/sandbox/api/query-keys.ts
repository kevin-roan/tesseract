import type { ProjectFilter } from "@theone/protocol";

import type { PageKind } from "../types";

const filterKey = (filter?: ProjectFilter): ProjectFilter => (filter?.projectId ? { projectId: filter.projectId } : {});

export const sandboxKeys = {
  root: ["sandbox"] as const,
  all: (sandboxId: string) => ["sandbox", sandboxId] as const,
  status: (sandboxId: string) => ["sandbox", sandboxId, "status"] as const,
  stt: (sandboxId: string) => ["sandbox", sandboxId, "stt"] as const,
  identity: (sandboxId: string) => ["sandbox", sandboxId, "identity"] as const,
  display: (sandboxId: string) => ["sandbox", sandboxId, "display"] as const,
  displayBrowser: (sandboxId: string) => ["sandbox", sandboxId, "display", "browser"] as const,
  displayWindows: (sandboxId: string) => ["sandbox", sandboxId, "display", "windows"] as const,
  activity: (sandboxId: string) => ["sandbox", sandboxId, "activity"] as const,
  projects: (sandboxId: string) => ["sandbox", sandboxId, "projects"] as const,
  project: (sandboxId: string, projectId: string) => ["sandbox", sandboxId, "projects", projectId] as const,
  projectGit: (sandboxId: string, projectId: string) => ["sandbox", sandboxId, "projects", projectId, "git"] as const,
  syncChanges: (sandboxId: string, projectId: string) =>
    ["sandbox", sandboxId, "projects", projectId, "sync", "changes"] as const,
  syncRequests: (sandboxId: string, projectId: string) =>
    ["sandbox", sandboxId, "projects", projectId, "sync", "requests"] as const,
  processLists: (sandboxId: string) => ["sandbox", sandboxId, "processes"] as const,
  processes: (sandboxId: string, filter?: ProjectFilter) => ["sandbox", sandboxId, "processes", filterKey(filter)] as const,
  terminals: (sandboxId: string) => ["sandbox", sandboxId, "terminals"] as const,
  ports: (sandboxId: string) => ["sandbox", sandboxId, "ports"] as const,
  buildLists: (sandboxId: string) => ["sandbox", sandboxId, "builds", "list"] as const,
  builds: (sandboxId: string, filter?: ProjectFilter) => ["sandbox", sandboxId, "builds", "list", filterKey(filter)] as const,
  buildDetails: (sandboxId: string) => ["sandbox", sandboxId, "builds", "detail"] as const,
  build: (sandboxId: string, buildId: string) => ["sandbox", sandboxId, "builds", "detail", buildId] as const,
  artifactLists: (sandboxId: string) => ["sandbox", sandboxId, "artifacts"] as const,
  artifacts: (sandboxId: string, filter?: ProjectFilter) => ["sandbox", sandboxId, "artifacts", filterKey(filter)] as const,
  taildropTargets: (sandboxId: string) => ["sandbox", sandboxId, "taildrop"] as const,
  agentRunLists: (sandboxId: string) => ["sandbox", sandboxId, "agent-runs", "list"] as const,
  agentRuns: (sandboxId: string, filter?: ProjectFilter) =>
    ["sandbox", sandboxId, "agent-runs", "list", filterKey(filter)] as const,
  agentRun: (sandboxId: string, runId: string) => ["sandbox", sandboxId, "agent-runs", "detail", runId] as const,
  page: (sandboxId: string, page: PageKind, id: string | null) => ["sandbox", sandboxId, "page", page, id] as const,
};

export function filterFromKey(queryKey: readonly unknown[]): ProjectFilter {
  const candidate = queryKey[queryKey.length - 1];
  if (typeof candidate !== "object" || candidate === null) return {};
  const projectId = (candidate as ProjectFilter).projectId;
  return typeof projectId === "string" ? { projectId } : {};
}

export function matchesFilter(filter: ProjectFilter, projectId: string | null): boolean {
  return !filter.projectId || filter.projectId === projectId;
}
