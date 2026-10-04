import { useQueryClient } from "@tanstack/react-query";

import { useSandboxQuery } from "@/features/sandbox/hooks/use-sandbox-query";

import { cachedAppRun } from "../api/cache";
import { appRunKeys } from "../api/query-keys";

export const useRunTargets = (projectId: string, refetchInterval?: number) =>
  useSandboxQuery(
    (sandboxId) => appRunKeys.targets(sandboxId, projectId),
    (client, signal) => client.listRunTargets(projectId, { signal }),
    { enabled: projectId.length > 0, refetchInterval },
  );

export const useAppRunList = (projectId: string) =>
  useSandboxQuery(
    (sandboxId) => appRunKeys.list(sandboxId, { projectId }),
    (client, signal) => client.listAppRuns({ projectId }, { signal }),
    { enabled: projectId.length > 0 },
  );

export function useAppRun(runId: string) {
  const queryClient = useQueryClient();
  return useSandboxQuery(
    (sandboxId) => appRunKeys.detail(sandboxId, runId),
    (client, signal) => client.getAppRun(runId, { signal }),
    { enabled: runId.length > 0, initialData: (sandboxId) => cachedAppRun(queryClient, sandboxId, runId) },
  );
}
