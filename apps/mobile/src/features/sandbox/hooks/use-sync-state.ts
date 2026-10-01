import { useMemo } from "react";

import { activeSyncRequest, syncEmptyState } from "../utils/sync";
import { useCreateSyncRequest } from "./use-sandbox-mutations";
import { useSyncChanges, useSyncRequests } from "./use-sandbox-queries";

/** The changes, requests and create mutation behind every "Sync to host" control. */
export function useSyncState(projectId: string, refetchInterval?: number) {
  const changesQuery = useSyncChanges(projectId, refetchInterval);
  const requestsQuery = useSyncRequests(projectId);
  const createRequest = useCreateSyncRequest();

  const changes = useMemo(() => changesQuery.data?.changes ?? [], [changesQuery.data]);
  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const active = activeSyncRequest(requests);

  return {
    changesQuery,
    requestsQuery,
    createRequest,
    changes,
    requests,
    active,
    empty: syncEmptyState(changesQuery.data),
    busy: active !== null || createRequest.isPending,
  };
}
