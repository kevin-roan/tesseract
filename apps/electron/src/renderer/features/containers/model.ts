import type {
  ContainersPhase,
  ContainersReport,
  ContainerState,
  DomainRoute,
  RouteScheme,
  RouteStatus,
  ServerContainer,
} from "../../../shared/contracts/containers";
import type { ChoiceOption } from "../../components/ChoiceDropdown";
import type { SegmentOption } from "../../components/SegmentedControl";
import type { KeyValueEntry } from "../../components/KeyValueList";
import type { SidebarContainerActivity, SidebarContainerItem, SidebarContainersState } from "../../components/Sidebar";
import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import { MB_PER_GB, MEMORY_UNITS, PORT_RANGE, ROUTE_SCHEMES, type MemoryUnit } from "./constants";
import { CONTAINERS_LABELS as L, DOMAINS_LABELS } from "./labels";
import type { ContainerShellStatus, CreateBlocker } from "./types";

export function containerTone(state: ContainerState): Tone {
  switch (state) {
    case "running":
      return "success";
    case "starting":
      return "info";
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

export function sidebarActivity(state: ContainerState, pending: boolean): SidebarContainerActivity {
  if (pending || state === "starting") return "busy";
  return state === "running" ? "running" : state === "error" ? "error" : "stopped";
}

export function sortContainers(containers: readonly ServerContainer[]): ServerContainer[] {
  return [...containers].sort((a, b) => a.name.localeCompare(b.name));
}

export function sidebarContainerItems(containers: readonly ServerContainer[], pending: ReadonlySet<string>): SidebarContainerItem[] {
  return sortContainers(containers).map((container) => ({
    name: container.name,
    activity: sidebarActivity(container.state, pending.has(container.name)),
    status: L.states[container.state],
  }));
}

export interface SidebarStateInput {
  containers: readonly ServerContainer[] | null;
  failed: boolean;
  sysbox: boolean | null;
}

export function containersSidebarState({ containers, failed, sysbox }: SidebarStateInput): SidebarContainersState {
  if (containers && containers.length > 0) return "ready";
  if (failed || sysbox === false) return "unavailable";
  return containers ? "empty" : "loading";
}

export function formatMemory(memoryMb: number): string {
  if (memoryMb >= MB_PER_GB) {
    const gb = memoryMb / MB_PER_GB;
    return L.resources.memory(Number.isInteger(gb) ? String(gb) : gb.toFixed(1), L.create.units.gb);
  }
  return L.resources.memory(String(memoryMb), L.create.units.mb);
}

export function formatResources(container: Pick<ServerContainer, "cpus" | "memoryMb">): string {
  const parts = [container.cpus === null ? null : L.resources.cpus(container.cpus), container.memoryMb === null ? null : formatMemory(container.memoryMb)];
  const present = parts.filter((part): part is string => part !== null);
  return present.length > 0 ? present.join(L.separator) : L.resources.shared;
}

export function sshCommand(container: ServerContainer): string | null {
  return container.tailnet ? `ssh ${container.tailnet.sshTarget}` : null;
}

export function containerSubtitle(container: ServerContainer, routeCount: number): string {
  const parts = [container.tailnet?.dnsName ?? L.list.offTailnet, formatResources(container), L.list.routes(routeCount)];
  return parts.filter((part): part is string => Boolean(part)).join(L.separator);
}

export function containerProperties(container: ServerContainer, formatDate: (iso: string) => string): KeyValueEntry[] {
  const tailnet = container.tailnet;
  return [
    [L.detail.status, container.status || L.states[container.state]],
    [L.detail.dnsName, tailnet?.dnsName ?? L.list.offTailnet],
    [L.detail.ip, tailnet?.ip ?? L.none],
    [L.detail.cpus, container.cpus === null ? L.resources.unlimited : String(container.cpus)],
    [L.detail.memory, container.memoryMb === null ? L.resources.unlimited : formatMemory(container.memoryMb)],
    [L.detail.image, container.image],
    [L.detail.tunnel, L.tunnel[container.tunnel]],
    [L.detail.created, formatDate(container.createdAt)],
  ];
}

export function parseOptionalNumber(text: string): number | null | undefined {
  const value = text.trim();
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function toMemoryMb(value: number | null, unit: MemoryUnit): number | null {
  if (value === null) return null;
  return Math.round(unit === "gb" ? value * MB_PER_GB : value);
}

export interface CreateValues {
  name: string;
  cpus: string;
  memory: string;
}

export type CreateField = keyof CreateValues;

export function createErrors(values: CreateValues): Partial<Record<CreateField, string>> {
  const errors: Partial<Record<CreateField, string>> = {};
  if (!values.name.trim()) errors.name = L.create.nameRequired;
  if (parseOptionalNumber(values.cpus) === undefined) errors.cpus = L.create.invalidCpus;
  if (parseOptionalNumber(values.memory) === undefined) errors.memory = L.create.invalidMemory;
  return errors;
}

export function createBlocker(report: ContainersReport | null): CreateBlocker | null {
  if (!report) return null;
  if (!report.sysbox) return "sysbox";
  return report.image ? null : "image";
}

export function buildStep(phase: ContainersPhase | null): string | null {
  return phase?.kind === "building" ? phase.step : null;
}

export function normalizeHostPart(text: string): string {
  return text.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

export function composeHostname(subdomain: string, zone: string): string {
  const sub = normalizeHostPart(subdomain);
  const apex = normalizeHostPart(zone);
  if (!apex) return sub;
  return sub ? `${sub}.${apex}` : apex;
}

export function parsePort(text: string): number | null {
  const value = text.trim();
  if (!/^\d+$/.test(value)) return null;
  const port = Number(value);
  return port >= PORT_RANGE.min && port <= PORT_RANGE.max ? port : null;
}

export function routeTone(status: RouteStatus): Tone {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "info";
    default:
      return "danger";
  }
}

export function routesFor(routes: readonly DomainRoute[], container: string): DomainRoute[] {
  return routes.filter((route) => route.container === container);
}

export function sortRoutes(routes: readonly DomainRoute[]): DomainRoute[] {
  return [...routes].sort((a, b) => a.hostname.localeCompare(b.hostname));
}

export function upsertContainer(list: readonly ServerContainer[] | undefined, container: ServerContainer): ServerContainer[] {
  const current = list ?? [];
  return current.some((entry) => entry.name === container.name)
    ? current.map((entry) => (entry.name === container.name ? container : entry))
    : [...current, container];
}

export function withoutContainer(list: readonly ServerContainer[] | undefined, name: string): ServerContainer[] {
  return (list ?? []).filter((entry) => entry.name !== name);
}

export function upsertRoute(list: readonly DomainRoute[] | undefined, route: DomainRoute): DomainRoute[] {
  const current = (list ?? []).filter((entry) => entry.id !== route.id);
  return [...current, route];
}

export function withoutRoutes(list: readonly DomainRoute[] | undefined, keep: (route: DomainRoute) => boolean): DomainRoute[] {
  return (list ?? []).filter(keep);
}

export function zoneOptions(report: ContainersReport | null): ChoiceOption[] {
  return (report?.cloudflare.zones ?? []).map((zone) => ({ id: zone.name, label: zone.name }));
}

export function containerOptions(containers: readonly ServerContainer[] | null): ChoiceOption[] {
  return sortContainers(containers ?? []).map((container) => ({ id: container.name, label: container.name }));
}

export function schemeOptions(): SegmentOption<RouteScheme>[] {
  return ROUTE_SCHEMES.map((id) => ({ id, label: DOMAINS_LABELS.add.schemes[id] }));
}

export function memoryUnitOptions(): ChoiceOption<MemoryUnit>[] {
  return MEMORY_UNITS.map((id) => ({ id, label: L.create.units[id] }));
}

export interface BadgeView {
  label: string;
  tone: Tone;
}

export function cloudflareBadge(cloudflare: ContainersReport["cloudflare"] | null): BadgeView {
  const badge = DOMAINS_LABELS.cloudflare.badge;
  if (cloudflare?.connected) return { label: badge.connected, tone: "success" };
  if (cloudflare?.error) return { label: badge.error, tone: "danger" };
  return { label: badge.disconnected, tone: "neutral" };
}

export function cloudflareSummary(cloudflare: ContainersReport["cloudflare"] | null): string {
  const L = DOMAINS_LABELS.cloudflare;
  if (cloudflare?.error) return cloudflare.error;
  return cloudflare?.connected ? L.connected(cloudflare.zones.length) : L.disconnected;
}

export type ListStateAction = "create" | "retry" | "settings" | "back";

export interface ListStateView {
  title: string;
  message?: string | null;
  icon?: IconName;
  loading?: boolean;
  action?: { id: ListStateAction; label: string };
  secondary?: { id: ListStateAction; label: string };
}

export function containersListState(containers: readonly ServerContainer[] | null, error: string | null): ListStateView | null {
  if (containers && containers.length > 0) return null;
  if (error) {
    return {
      title: L.list.unavailable,
      message: error,
      icon: "warning",
      action: { id: "retry", label: L.list.tryAgain },
      secondary: { id: "settings", label: L.list.settings },
    };
  }
  if (!containers) return { title: L.list.loading, loading: true };
  return { title: L.list.empty, message: L.list.emptyMessage, icon: "server", action: { id: "create", label: L.list.create } };
}

export function routeCounts(routes: readonly DomainRoute[] | null): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const route of routes ?? []) counts.set(route.container, (counts.get(route.container) ?? 0) + 1);
  return counts;
}

export function containerDetailState(containers: readonly ServerContainer[] | null, name: string, error: string | null): ListStateView | null {
  if (containers?.some((container) => container.name === name)) return null;
  if (error) return containersListState(null, error);
  if (!containers) return { title: L.detail.loading, loading: true };
  return { title: L.detail.notFound, message: L.detail.notFoundMessage(name), icon: "server", action: { id: "back", label: L.detail.back } };
}

export function formatCreated(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? L.none : date.toLocaleString();
}

export interface ShellPanelView {
  status: (BadgeView & { live: boolean }) | null;
  action: "open" | "reopen" | null;
  placeholder: string | null;
}

export function shellPanelView(status: ContainerShellStatus, running: boolean): ShellPanelView {
  const action = !running ? null : status.kind === "idle" || status.kind === "error" ? "open" : status.kind === "exited" ? "reopen" : null;
  switch (status.kind) {
    case "idle":
      return { status: null, action, placeholder: running ? L.detail.shellHint : L.detail.shellStopped };
    case "connecting":
      return { status: { label: L.detail.shellStatus.connecting, tone: "info", live: true }, action, placeholder: null };
    case "open":
      return { status: { label: L.detail.shellStatus.open, tone: "success", live: true }, action, placeholder: null };
    case "exited":
      return { status: { label: L.detail.shellStatus.exited(status.code), tone: "neutral", live: false }, action, placeholder: null };
    case "error":
      return { status: { label: L.detail.shellStatus.error, tone: "danger", live: false }, action, placeholder: status.message };
  }
}
