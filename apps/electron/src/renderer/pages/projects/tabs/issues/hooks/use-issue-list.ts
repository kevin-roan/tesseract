import { useCallback } from "react";
import { useApiQuery } from "../../../../../app/data";
import { ISSUES_QUERY_KEYS, ISSUES_REFRESH_MS } from "../constants";
import { sortIssues } from "../model";

export function useIssueList(projectId: string, visible: boolean) {
  const query = useApiQuery(
    ISSUES_QUERY_KEYS.list(projectId),
    async (client, signal) => sortIssues(await client.listIssues({ projectId }, { signal })),
    { refetchInterval: visible ? ISSUES_REFRESH_MS : false },
  );
  const { refetch } = query;
  const refresh = useCallback(() => void refetch(), [refetch]);
  return { issues: query.data ?? null, error: query.error, refresh };
}
