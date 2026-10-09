import { useCallback, useMemo } from "react";
import { errorMessage } from "../../../components/FormDialog";
import { containersListState, routeCounts, sortContainers, type ListStateAction } from "../model";
import { useContainerActions, usePendingContainers } from "./use-container-actions";
import { useContainers } from "./use-containers";
import { useDomainRoutes } from "./use-domain-routes";

export interface ContainersListHandlers {
  onCreate(): void;
  onSettings(): void;
}

export function useContainersList({ onCreate, onSettings }: ContainersListHandlers) {
  const { containers, error, refresh } = useContainers();
  const { routes, refresh: refreshRoutes } = useDomainRoutes();
  const pending = usePendingContainers();
  const actions = useContainerActions();
  const sorted = useMemo(() => sortContainers(containers ?? []), [containers]);
  const counts = useMemo(() => routeCounts(routes), [routes]);
  const state = containersListState(containers, error && !containers ? errorMessage(error) : null);
  const reload = useCallback(() => {
    refresh();
    refreshRoutes();
  }, [refresh, refreshRoutes]);
  const onAction = useCallback(
    (action: ListStateAction) => {
      if (action === "create") onCreate();
      else if (action === "settings") onSettings();
      else reload();
    },
    [onCreate, onSettings, reload],
  );
  return { containers: sorted, counts, pending, actions, state, reload, onAction };
}
