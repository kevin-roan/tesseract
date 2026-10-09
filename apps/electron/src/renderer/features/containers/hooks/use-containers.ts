import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import type { ServerContainer } from "../../../../shared/contracts/containers";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_KEYS, CONTAINERS_POLL } from "../constants";

export function useContainers() {
  const queryClient = useQueryClient();
  useEffect(() => ipc.containers.on("containers", (list) => queryClient.setQueryData<ServerContainer[]>(CONTAINERS_KEYS.list, list)), [queryClient]);
  const query = useQuery({
    queryKey: CONTAINERS_KEYS.list,
    queryFn: () => ipc.containers.list(),
    refetchInterval: (current) => (current.state.status === "error" ? false : CONTAINERS_POLL.listMs),
  });
  const { refetch } = query;
  const refresh = useCallback(() => void refetch(), [refetch]);
  return { containers: query.data ?? null, error: query.error, failed: query.isError && !query.data, refresh };
}
