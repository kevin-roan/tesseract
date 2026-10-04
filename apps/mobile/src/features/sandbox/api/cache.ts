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
  SyncChanges,
  SyncRequest,
  TerminalInfo,
} from "@theone/protocol";

import { storeAppRun } from "@/features/app-runs/api/cache";
import { storeInboxEvent } from "@/features/inbox/api/cache";

import { ACTIVITY_LIMIT } from "../utils/constants";
import { prependCapped, removeByIds, upsertById, type UpsertPlacement } from "../utils/collections";
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

function removeFromLists<T extends { id: string }>(queryClient: QueryClient, listsKey: QueryKey, ids: string[]): void {
  queryClient.setQueriesData<T[]>({ queryKey: listsKey }, (data) => (data ? removeByIds(data, ids) : data));
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

export function removeArtifact(queryClient: QueryClient, sandboxId: string, id: string): void {
  removeFromLists<Artifact>(queryClient, sandboxKeys.artifactLists(sandboxId), [id]);
  for (const [queryKey, build] of queryClient.getQueriesData<BuildJob>({ queryKey: sandboxKeys.buildDetails(sandboxId) })) {
    if (build?.artifacts.some((artifact) => artifact.id === id)) {
      queryClient.setQueryData<BuildJob>(queryKey, { ...build, artifacts: removeByIds(build.artifacts, [id]) });
    }
  }
}

export function storeAgentRun(queryClient: QueryClient, sandboxId: string, run: AgentRun, seed = false): void {
  queryClient.setQueryData<AgentRunDetail>(sandboxKeys.agentRun(sandboxId, run.id), (detail) => {
    if (detail) return { ...detail, ...run };
    return seed ? { ...run, events: [] } : detail;
  });
  if (run.archivedAt) return removeFromLists(queryClient, sandboxKeys.agentRunLists(sandboxId), [run.id]);
  patchFilteredLists(queryClient, sandboxKeys.agentRunLists(sandboxId), run, run.projectId);
}

export function removeAgentRuns(queryClient: QueryClient, sandboxId: string, ids: string[]): void {
  removeFromLists(queryClient, sandboxKeys.agentRunLists(sandboxId), ids);
  for (const id of ids) queryClient.removeQueries({ queryKey: sandboxKeys.agentRun(sandboxId, id), exact: true });
}

export function storeProject(queryClient: QueryClient, sandboxId: string, project: Project): void {
  queryClient.setQueryData(sandboxKeys.project(sandboxId, project.id), project);
  patchList(queryClient, sandboxKeys.projects(sandboxId), project, "end");
  void queryClient.invalidateQueries({ queryKey: sandboxKeys.projectGit(sandboxId, project.id) });
}

export function removeProject(queryClient: QueryClient, sandboxId: string, projectId: string): void {
  queryClient.setQueryData<Project[]>(sandboxKeys.projects(sandboxId), (data) => (data ? removeByIds(data, [projectId]) : data));
  queryClient.removeQueries({ queryKey: sandboxKeys.project(sandboxId, projectId) });
}

export function storeSyncRequest(queryClient: QueryClient, sandboxId: string, request: SyncRequest): void {
  patchList(queryClient, sandboxKeys.syncRequests(sandboxId, request.projectId), request);
}

export function storeSyncChanges(queryClient: QueryClient, sandboxId: string, changes: SyncChanges): void {
  queryClient.setQueryData(sandboxKeys.syncChanges(sandboxId, changes.projectId), changes);
}

export function invalidateSyncChanges(queryClient: QueryClient, sandboxId: string, projectId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: sandboxKeys.syncChanges(sandboxId, projectId) });
}

/** A request moved: patch it in, and once it applied the sandbox's changes (and the host baseline) moved too. */
function applySyncRequest(queryClient: QueryClient, sandboxId: string, request: SyncRequest): void {
  storeSyncRequest(queryClient, sandboxId, request);
  if (request.status === "applied") void invalidateSyncChanges(queryClient, sandboxId, request.projectId);
}

function refreshSyncState(queryClient: QueryClient, sandboxId: string, projectId: string): void {
  void invalidateSyncChanges(queryClient, sandboxId, projectId);
  void queryClient.invalidateQueries({ queryKey: sandboxKeys.syncRequests(sandboxId, projectId) });
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
    case "artifact.deleted":
      return removeArtifact(queryClient, sandboxId, event.id);
    case "agent.updated":
      return storeAgentRun(queryClient, sandboxId, event.run);
    case "agent.deleted":
      return removeAgentRuns(queryClient, sandboxId, event.ids);
    case "project.updated":
      return storeProject(queryClient, sandboxId, event.project);
    case "project.deleted":
      return removeProject(queryClient, sandboxId, event.id);
    case "status":
      return storeActivity(queryClient, sandboxId, event.event);
    case "sync.updated":
      return applySyncRequest(queryClient, sandboxId, event.request);
    case "sync.changed":
      return refreshSyncState(queryClient, sandboxId, event.projectId);
    case "inbox.updated":
      return storeInboxEvent(queryClient, sandboxId, event);
    case "app.updated":
      return storeAppRun(queryClient, sandboxId, event.run);
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
