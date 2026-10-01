import { keepPreviousData, useQuery, type QueryKey } from "@tanstack/react-query";
import type { TheOneClient } from "@theone/client";
import { LIMITS } from "@theone/protocol";
import { useIsFocused } from "expo-router";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";

import { analyticsKeys } from "../api/query-keys";

function useAnalyticsQuery<T>(
  key: (sandboxId: string) => QueryKey,
  fetcher: (client: TheOneClient, signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const { sandbox, client } = useSandboxClient();
  const focused = useIsFocused();

  return useQuery({
    queryKey: sandbox ? key(sandbox.id) : sandboxKeys.root,
    queryFn: ({ signal }) => {
      if (!client) throw new Error("No sandbox is paired.");
      return fetcher(client, signal);
    },
    enabled: client !== null && enabled,
    subscribed: focused,
    placeholderData: keepPreviousData,
  });
}

export const useUsageReport = (days: number | null) =>
  useAnalyticsQuery(
    (sandboxId) => analyticsKeys.usage(sandboxId, days ?? 0),
    (client, signal) => client.usage({ days: days ?? 1 }, { signal }),
    days !== null,
  );

export const useClaudeSessions = (projectId: string | null = null) =>
  useAnalyticsQuery(
    (sandboxId) => analyticsKeys.sessions(sandboxId, projectId),
    (client, signal) =>
      client.sessions(
        projectId ? { limit: LIMITS.maxSessionsList, projectId } : { limit: LIMITS.maxSessionsList },
        { signal },
      ),
  );
