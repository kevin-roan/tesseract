import { useMemo } from "react";
import { useLocation } from "react-router";
import { ROUTE } from "../../../shared/routes";
import { useContainerActions, usePendingContainers } from "../../features/containers/hooks/use-container-actions";
import { useContainers } from "../../features/containers/hooks/use-containers";
import { useContainersReport } from "../../features/containers/hooks/use-containers-report";
import { containerNameFromPath } from "../../features/containers/hooks/use-containers-routing";
import { containersSidebarState, sidebarContainerItems } from "../../features/containers/model";

const PAGE_PREFIX = `${ROUTE.page("containers")}/`;

export function useSidebarContainers() {
  const { containers, failed } = useContainers();
  const pending = usePendingContainers();
  const actions = useContainerActions();
  const empty = containers !== null && containers.length === 0;
  const { report } = useContainersReport({ enabled: empty });
  const pathname = useLocation().pathname;
  const selected = pathname.startsWith(PAGE_PREFIX) ? containerNameFromPath(pathname.slice(PAGE_PREFIX.length)) : null;
  const items = useMemo(() => sidebarContainerItems(containers ?? [], pending), [containers, pending]);
  return {
    items,
    selected,
    state: containersSidebarState({ containers, failed, sysbox: empty ? (report?.sysbox ?? null) : null }),
    start: actions.start,
    stop: actions.stop,
  };
}
