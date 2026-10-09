import type { DomainRoute, ServerContainer } from "../../../../shared/contracts/containers";
import type { RecordRowProps, RowAction } from "../../../components/RecordRow";
import { CONTAINERS_URLS } from "../../../features/containers/constants";
import { CONTAINERS_LABELS, DOMAINS_LABELS } from "../../../features/containers/labels";
import { containerSubtitle, containerTone, routeTone } from "../../../features/containers/model";

export interface RouteRowHandlers {
  open(url: string): void;
  copy(url: string): void;
  remove(route: DomainRoute): void;
}

export interface RouteRowOptions {
  showContainer: boolean;
  removing: boolean;
}

export function routeRow(route: DomainRoute, { showContainer, removing }: RouteRowOptions, handlers: RouteRowHandlers): RecordRowProps {
  const L = DOMAINS_LABELS.routes;
  const url = CONTAINERS_URLS.routeUrl(route.hostname);
  return {
    icon: "globe",
    title: route.hostname,
    subtitle: route.error ?? (showContainer ? L.target(route.container, route.port) : L.port(route.port)),
    meta: DOMAINS_LABELS.add.schemes[route.scheme],
    status: { label: L.status[route.status], tone: routeTone(route.status) },
    actions: [
      { id: "open", icon: "external", label: L.open, onActivate: () => handlers.open(url) },
      { id: "copy", icon: "copy", label: L.copy, onActivate: () => handlers.copy(url) },
      { id: "remove", icon: "delete", label: L.remove, destructive: true, sensitive: !removing, onActivate: () => handlers.remove(route) },
    ],
    onActivate: () => handlers.open(url),
  };
}

export interface ContainerRowHandlers {
  open(name: string): void;
  start(name: string): void;
  stop(name: string): void;
}

export function containerRow(container: ServerContainer, routeCount: number, pending: boolean, handlers: ContainerRowHandlers): RecordRowProps {
  const L = CONTAINERS_LABELS;
  const running = container.state === "running";
  const actions: RowAction[] = pending || container.state === "starting"
    ? []
    : [
        running
          ? { id: "stop", icon: "stop", label: L.actions.stop, onActivate: () => handlers.stop(container.name) }
          : { id: "start", icon: "play", label: L.actions.start, onActivate: () => handlers.start(container.name) },
      ];
  return {
    icon: "server",
    iconColor: running ? "text-secondary" : "text-tertiary",
    title: container.name,
    subtitle: containerSubtitle(container, routeCount),
    status: { label: L.states[container.state], tone: containerTone(container.state), live: running },
    actions,
    onActivate: () => handlers.open(container.name),
  };
}
