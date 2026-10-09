import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ContainersReport } from "../../../../shared/contracts/containers";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_KEYS, CONTAINERS_POLL } from "../constants";

export interface ContainersReportOptions {
  enabled?: boolean;
}

export function useContainersReport({ enabled = true }: ContainersReportOptions = {}) {
  const query = useQuery({
    queryKey: CONTAINERS_KEYS.report,
    queryFn: () => ipc.containers.report(),
    staleTime: CONTAINERS_POLL.reportStaleMs,
    enabled,
  });
  const { refetch } = query;
  const refresh = useCallback(() => void refetch(), [refetch]);
  return { report: query.data ?? null, error: query.error, checking: query.isFetching, refresh };
}

export function useSetReport() {
  const queryClient = useQueryClient();
  return useCallback((report: ContainersReport) => queryClient.setQueryData<ContainersReport>(CONTAINERS_KEYS.report, report), [queryClient]);
}
