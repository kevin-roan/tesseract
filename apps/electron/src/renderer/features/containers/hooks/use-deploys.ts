import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import type { HostDeploy } from "../../../../shared/contracts/containers";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_KEYS, CONTAINERS_POLL } from "../constants";
import { awaitingApprovalCounts, deploysFor, sortDeploys } from "../model";

export function useDeploys(container?: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => ipc.containers.on("deploys", (deploys) => queryClient.setQueryData<HostDeploy[]>(CONTAINERS_KEYS.deploys, deploys)), [queryClient]);
  const query = useQuery({
    queryKey: CONTAINERS_KEYS.deploys,
    queryFn: () => ipc.containers.deploys(),
    refetchInterval: (current) => (current.state.status === "error" ? false : CONTAINERS_POLL.deploysMs),
  });
  const data = query.data ?? null;
  const deploys = useMemo(() => sortDeploys(deploysFor(data ?? [], container)), [data, container]);
  const awaiting = useMemo(() => awaitingApprovalCounts(data), [data]);
  const { refetch } = query;
  const refresh = useCallback(() => void refetch(), [refetch]);
  return { deploys, awaiting, loading: query.isPending, error: query.error, refresh };
}
