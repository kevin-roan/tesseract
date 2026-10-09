import { useCallback, useMemo, useState } from "react";
import { errorMessage } from "../../../components/FormDialog";
import { containerDetailState, containerProperties, formatCreated, routesFor, sortRoutes, sshCommand, type ListStateAction } from "../model";
import { useContainerActions, usePendingContainers } from "./use-container-actions";
import { useContainerLogs } from "./use-container-logs";
import { useContainers } from "./use-containers";
import { useDomainRoutes } from "./use-domain-routes";

export interface ContainerDetailHandlers {
  onBack(): void;
  onSettings(): void;
}

export function useContainerDetail(name: string, { onBack, onSettings }: ContainerDetailHandlers) {
  const { containers, error, refresh } = useContainers();
  const { routes, refresh: refreshRoutes } = useDomainRoutes();
  const pending = usePendingContainers();
  const actions = useContainerActions();
  const container = containers?.find((entry) => entry.name === name) ?? null;
  const logs = useContainerLogs(name, container !== null);
  const own = useMemo(() => sortRoutes(routesFor(routes ?? [], name)), [routes, name]);
  const properties = useMemo(() => (container ? containerProperties(container, formatCreated) : []), [container]);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const { refresh: refreshLogs } = logs;
  const { remove } = actions;

  const reload = useCallback(() => {
    refresh();
    refreshRoutes();
    refreshLogs();
  }, [refresh, refreshLogs, refreshRoutes]);

  const onAction = useCallback(
    (action: ListStateAction) => {
      if (action === "back") onBack();
      else if (action === "settings") onSettings();
      else reload();
    },
    [onBack, onSettings, reload],
  );

  return {
    container,
    state: containerDetailState(containers, name, error && !containers ? errorMessage(error) : null),
    busy: pending.has(name) || container?.state === "starting",
    properties,
    ssh: container ? sshCommand(container) : null,
    routes: own,
    logs,
    actions,
    reload,
    onAction,
    removeOpen,
    openRemove: useCallback(() => setRemoveOpen(true), []),
    closeRemove: useCallback(() => setRemoveOpen(false), []),
    confirmRemove: useCallback(() => remove(name, onBack), [name, onBack, remove]),
    routeOpen,
    openRoute: useCallback(() => setRouteOpen(true), []),
    closeRoute: useCallback(() => setRouteOpen(false), []),
  };
}
