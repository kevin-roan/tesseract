import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import type { DomainRoute } from "../../../../shared/contracts/containers";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_KEYS, CONTAINERS_POLL } from "../constants";

export function useDomainRoutes() {
  const queryClient = useQueryClient();
  useEffect(() => ipc.containers.on("routes", (routes) => queryClient.setQueryData<DomainRoute[]>(CONTAINERS_KEYS.routes, routes)), [queryClient]);
  const query = useQuery({
    queryKey: CONTAINERS_KEYS.routes,
    queryFn: () => ipc.containers.routes(),
    refetchInterval: CONTAINERS_POLL.routesMs,
  });
  const { refetch } = query;
  const refresh = useCallback(() => void refetch(), [refetch]);
  return { routes: query.data ?? null, error: query.error, refresh };
}
