import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectFilter, StatusEvent } from "@theone/protocol";

import { sandboxKeys } from "../api/query-keys";
import { PORTS_REFRESH_INTERVAL_MS, STATUS_REFRESH_INTERVAL_MS, WINDOWS_REFRESH_INTERVAL_MS } from "../utils/constants";
import { useActiveSandbox } from "./use-sandbox-client";
import { useSandboxQuery } from "./use-sandbox-query";

export const useSandboxStatus = () =>
  useSandboxQuery(sandboxKeys.status, (client, signal) => client.status({ signal }), {
    refetchInterval: STATUS_REFRESH_INTERVAL_MS,
  });

export const useSandboxIdentity = () =>
  useSandboxQuery(sandboxKeys.identity, (client, signal) => client.identity({ signal }));

export const useSttStatus = () =>
  useSandboxQuery(sandboxKeys.stt, (client, signal) => client.stt({ signal }));

export const useDisplayStatus = () =>
  useSandboxQuery(sandboxKeys.display, (client, signal) => client.displayStatus({ signal }));

export const useDisplayBrowser = (enabled = true) =>
  useSandboxQuery(sandboxKeys.displayBrowser, (client, signal) => client.displayBrowser({ signal }), { enabled });

export const useDisplayWindows = (enabled = true) =>
  useSandboxQuery(sandboxKeys.displayWindows, (client, signal) => client.displayWindows({ signal }), {
    enabled,
    refetchInterval: WINDOWS_REFRESH_INTERVAL_MS,
  });

export const useProjects = () =>
  useSandboxQuery(sandboxKeys.projects, (client, signal) => client.listProjects({ signal }));

export const useProject = (projectId: string) =>
  useSandboxQuery(
    (sandboxId) => sandboxKeys.project(sandboxId, projectId),
    (client, signal) => client.getProject(projectId, { signal }),
    { enabled: projectId.length > 0 },
  );

export const useProjectGit = (projectId: string, enabled = true) =>
  useSandboxQuery(
    (sandboxId) => sandboxKeys.projectGit(sandboxId, projectId),
    (client, signal) => client.getProjectGit(projectId, { signal }),
    { enabled: enabled && projectId.length > 0 },
  );

export const useSyncChanges = (projectId: string, refetchInterval?: number) =>
  useSandboxQuery(
    (sandboxId) => sandboxKeys.syncChanges(sandboxId, projectId),
    (client, signal) => client.syncChanges(projectId, { signal }),
    { enabled: projectId.length > 0, refetchInterval },
  );

export const useSyncRequests = (projectId: string) =>
  useSandboxQuery(
    (sandboxId) => sandboxKeys.syncRequests(sandboxId, projectId),
    (client, signal) => client.syncRequests(projectId, { signal }),
    { enabled: projectId.length > 0 },
  );

export const useProcesses = (filter?: ProjectFilter) =>
  useSandboxQuery(
    (sandboxId) => sandboxKeys.processes(sandboxId, filter),
    (client, signal) => client.listProcesses(filter, { signal }),
  );

export const useTerminals = () =>
  useSandboxQuery(sandboxKeys.terminals, (client, signal) => client.listTerminals({ signal }));

export const useListeningPorts = () =>
  useSandboxQuery(sandboxKeys.ports, (client, signal) => client.ports({ signal }), {
    refetchInterval: PORTS_REFRESH_INTERVAL_MS,
  });

export const useBuilds = (filter?: ProjectFilter) =>
  useSandboxQuery(
    (sandboxId) => sandboxKeys.builds(sandboxId, filter),
    (client, signal) => client.listBuilds(filter, { signal }),
  );

export const useBuild = (buildId: string) =>
  useSandboxQuery(
    (sandboxId) => sandboxKeys.build(sandboxId, buildId),
    (client, signal) => client.getBuild(buildId, { signal }),
    { enabled: buildId.length > 0 },
  );

export const useArtifacts = (filter?: ProjectFilter) =>
  useSandboxQuery(
    (sandboxId) => sandboxKeys.artifacts(sandboxId, filter),
    (client, signal) => client.listArtifacts(filter, { signal }),
  );

export const useBuildOutputs = (enabled = true) =>
  useSandboxQuery(sandboxKeys.buildOutputs, (client, signal) => client.listBuildOutputs(undefined, { signal }), { enabled });

export const useTaildropTargets = (enabled = true) =>
  useSandboxQuery(sandboxKeys.taildropTargets, (client, signal) => client.taildropTargets({ signal }), { enabled });

export const useAgentRuns = (filter?: ProjectFilter) =>
  useSandboxQuery(
    (sandboxId) => sandboxKeys.agentRuns(sandboxId, filter),
    (client, signal) => client.listAgentRuns(filter, { signal }),
  );

export const useAgentRun = (runId: string) =>
  useSandboxQuery(
    (sandboxId) => sandboxKeys.agentRun(sandboxId, runId),
    (client, signal) => client.getAgentRun(runId, { signal }),
    { enabled: runId.length > 0 },
  );

export function useSandboxActivity(): StatusEvent[] {
  const sandbox = useActiveSandbox();
  const queryClient = useQueryClient();
  const queryKey = sandbox ? sandboxKeys.activity(sandbox.id) : sandboxKeys.root;
  const { data } = useQuery({
    queryKey,
    queryFn: () => queryClient.getQueryData<StatusEvent[]>(queryKey) ?? [],
    enabled: sandbox !== null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data ?? [];
}
