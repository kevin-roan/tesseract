import { useCallback, useMemo, useState } from "react";
import { DOMAINS_LABELS as L } from "../labels";
import { sortRoutes } from "../model";
import { useContainersReport } from "./use-containers-report";
import { useDomainRoutes } from "./use-domain-routes";
import { useRouteActions } from "./use-route-actions";

export function useDomainsPage() {
  const { routes, refresh: refreshRoutes } = useDomainRoutes();
  const { report, refresh: refreshReport } = useContainersReport();
  const { resync, syncing } = useRouteActions();
  const [addOpen, setAddOpen] = useState(false);
  const sorted = useMemo(() => sortRoutes(routes ?? []), [routes]);
  const connected = report?.cloudflare.connected ?? false;
  const reload = useCallback(() => {
    refreshRoutes();
    refreshReport();
  }, [refreshReport, refreshRoutes]);
  return {
    routes: sorted,
    loading: routes === null,
    connected,
    emptyLabel: connected ? L.routes.empty : L.routes.needsCloudflare,
    resync,
    syncing,
    reload,
    addOpen,
    openAdd: useCallback(() => setAddOpen(true), []),
    closeAdd: useCallback(() => setAddOpen(false), []),
  };
}
