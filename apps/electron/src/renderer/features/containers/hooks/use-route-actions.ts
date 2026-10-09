import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { DomainRoute } from "../../../../shared/contracts/containers";
import { errorMessage } from "../../../components/FormDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { CONTAINERS_KEYS } from "../constants";
import { DOMAINS_LABELS as L } from "../labels";
import { withoutRoutes } from "../model";

export function useRouteActions() {
  const queryClient = useQueryClient();
  const removal = useMutation({
    mutationFn: (route: DomainRoute) => ipc.containers.removeRoute(route.id),
    onSuccess: (_result, route) => {
      queryClient.setQueryData<DomainRoute[]>(CONTAINERS_KEYS.routes, (routes) => withoutRoutes(routes, (entry) => entry.id !== route.id));
      showToast(L.routes.removed(route.hostname));
    },
    onError: (error, route) => showToast(L.routes.removeFailed(route.hostname, errorMessage(error))),
  });
  const sync = useMutation({
    mutationFn: () => ipc.containers.syncRoutes(),
    onSuccess: (routes) => {
      queryClient.setQueryData<DomainRoute[]>(CONTAINERS_KEYS.routes, routes);
      showToast(L.resynced);
    },
    onError: (error) => showToast(L.resyncFailed(errorMessage(error))),
  });
  const { mutate: removeMutate, isPending: removing, variables: removingRoute } = removal;
  const { mutate: syncMutate } = sync;
  const remove = useCallback((route: DomainRoute) => removeMutate(route), [removeMutate]);
  const resync = useCallback(() => syncMutate(), [syncMutate]);
  return { remove, removingId: removing ? (removingRoute?.id ?? null) : null, resync, syncing: sync.isPending };
}
