import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type {
  AgentRun,
  AgentRunDetail,
  Artifact,
  BuildJob,
  ProcessInfo,
  Project,
  ServerEvent,
  StatusEvent,
  TerminalInfo,
} from "@theone/protocol";

import { ACTIVITY_LIMIT } from "../utils/constants";
import { prependCapped, upsertById, type UpsertPlacement } from "../utils/collections";
import { filterFromKey, matchesFilter, sandboxKeys } from "./query-keys";

function patchFilteredLists<T extends { id: string }>(
  queryClient: QueryClient,
  listsKey: QueryKey,
  item: T,
  projectId: string | null,
): void {
  for (const [queryKey, data] of queryClient.getQueriesData<T[]>({ queryKey: listsKey })) {
    if (!data || !matchesFilter(filterFromKey(queryKey), projectId)) continue;
    queryClient.setQueryData<T[]>(queryKey, upsertById(data, item));
  }
}

function patchList<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  item: T,
  placement: UpsertPlacement = "start",
): void {
  queryClient.setQueryData<T[]>(queryKey, (data) => (data ? upsertById(data, item, placement) : data));
}

export function storeProcess(queryClient: QueryClient, sandboxId: string, process: ProcessInfo): void {
  patchFilteredLists(queryClient, sandboxKeys.processLists(sandboxId), process, process.projectId);
}

export function storeTerminal(queryClient: QueryClient, sandboxId: string, terminal: TerminalInfo): void {
  patchList(queryClient, sandboxKeys.terminals(sandboxId), terminal);
}

export function storeBuild(queryClient: QueryClient, sandboxId: string, build: BuildJob): void {
  queryClient.setQueryData(sandboxKeys.build(sandboxId, build.id), build);
  patchFilteredLists(queryClient, sandboxKeys.buildLists(sandboxId), build, build.projectId);
}

export function storeArtifact(queryClient: QueryClient, sandboxId: string, artifact: Artifact): void {
  patchFilteredLists(queryClient, sandboxKeys.artifactLists(sandboxId), artifact, artifact.projectId);
  if (!artifact.buildId) return;
  queryClient.setQueryData<BuildJob>(sandboxKeys.build(sandboxId, artifact.buildId), (build) =>
    build ? { ...build, artifacts: upsertById(build.artifacts, artifact, "end") } : build,
  );
}

export function storeAgentRun(queryClient: QueryClient, sandboxId: string, run: AgentRun, seed = false): void {
  queryClient.setQueryData<AgentRunDetail>(sandboxKeys.agentRun(sandboxId, run.id), (detail) => {
    if (detail) return { ...detail, ...run };
    return seed ? { ...run, events: [] } : detail;
  });
  patchFilteredLists(queryClient, sandboxKeys.agentRunLists(sandboxId), run, run.projectId);
}

export function storeProject(queryClient: QueryClient, sandboxId: string, project: Project): void {
  queryClient.setQueryData(sandboxKeys.project(sandboxId, project.id), project);
  patchList(queryClient, sandboxKeys.projects(sandboxId), project, "end");
  void queryClient.invalidateQueries({ queryKey: sandboxKeys.projectGit(sandboxId, project.id) });
}

export function storeActivity(queryClient: QueryClient, sandboxId: string, event: StatusEvent): void {
  queryClient.setQueryData<StatusEvent[]>(sandboxKeys.activity(sandboxId), (events) =>
    prependCapped(events ?? [], event, ACTIVITY_LIMIT),
  );
}

export function applyServerEvent(queryClient: QueryClient, sandboxId: string, event: ServerEvent): void {
  switch (event.type) {
    case "process.updated":
      return storeProcess(queryClient, sandboxId, event.process);
    case "terminal.updated":
      return storeTerminal(queryClient, sandboxId, event.terminal);
    case "build.updated":
      return storeBuild(queryClient, sandboxId, event.build);
    case "artifact.created":
      return storeArtifact(queryClient, sandboxId, event.artifact);
    case "agent.updated":
      return storeAgentRun(queryClient, sandboxId, event.run);
    case "project.updated":
      return storeProject(queryClient, sandboxId, event.project);
    case "status":
      return storeActivity(queryClient, sandboxId, event.event);
    case "hello":
    case "ping":
      return;
  }
}

export function resyncSandbox(queryClient: QueryClient, sandboxId: string): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: sandboxKeys.all(sandboxId),
    predicate: (query) => query.queryKey[2] !== "page" && query.queryKey[2] !== "activity" && query.state.fetchStatus === "idle",
  });
}
