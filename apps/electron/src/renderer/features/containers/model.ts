import type { DeployStatus } from "@tesseract/protocol";
import type {
  ContainersPhase,
  ContainersReport,
  ContainerState,
  DomainRoute,
  HostDeploy,
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
import { ACTIVE_DEPLOY_STATUSES, MB_PER_GB, MEMORY_UNITS, PORT_RANGE, ROUTE_SCHEMES, type MemoryUnit } from "./constants";
import { formatBytes, formatRelativeTime } from "../overview/format";
import { CONTAINERS_LABELS as L, DEPLOYS_LABELS, DOMAINS_LABELS } from "./labels";
import type { ContainersTaskPhase, ContainerShellStatus, CreateBlocker } from "./types";

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

export function sidebarContainerItems(
  containers: readonly ServerContainer[],
  pending: ReadonlySet<string>,
  awaiting: ReadonlyMap<string, number> = new Map(),
  requests: readonly HostDeploy[] = [],
): SidebarContainerItem[] {
  const items = sortContainers(containers).map((container): SidebarContainerItem => {
    const attention = awaiting.get(container.name) ?? 0;
    return {
      name: container.name,
      activity: sidebarActivity(container.state, pending.has(container.name)),
      status: L.states[container.state],
      attention,
      attentionLabel: attention > 0 ? DEPLOYS_LABELS.awaiting(attention) : undefined,
    };
  });
  return [...items, ...requestSidebarItems(requests)];
}

export function requestSidebarItems(requests: readonly HostDeploy[]): SidebarContainerItem[] {
  const groups = new Map<string, HostDeploy[]>();
  for (const request of requests) groups.set(request.container, [...(groups.get(request.container) ?? []), request]);
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, entries]) => {
      const attention = entries.filter(isAwaitingApproval).length;
      const creating = attention < entries.length;
      const status = creating ? DEPLOYS_LABELS.requests.creating : DEPLOYS_LABELS.requests.needsApproval;
      return {
        name,
        activity: creating ? "busy" : "requested",
        status,
        attention,
        attentionLabel: attention > 0 ? DEPLOYS_LABELS.requests.needsApproval : undefined,
        request: true,
      };
    });
}

export interface SidebarStateInput {
  containers: readonly ServerContainer[] | null;
  failed: boolean;
  sysbox: boolean | null;
  requests?: number;
}

export function containersSidebarState({ containers, failed, sysbox, requests = 0 }: SidebarStateInput): SidebarContainersState {
  if ((containers && containers.length > 0) || requests > 0) return "ready";
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
  if (!report.sysbox) return report.checks.some((check) => check.action === "setup-vm") ? "vm" : "sysbox";
  return report.image ? null : "image";
}

export function phaseStep(phase: ContainersPhase | null, kind: ContainersTaskPhase): string | null {
  return phase?.kind === kind ? phase.step : null;
}

export function isTaskPhase(phase: ContainersPhase | undefined): boolean {
  return phase?.kind === "building" || phase?.kind === "setting-up-vm";
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

export function containersListState(containers: readonly ServerContainer[] | null, error: string | null, requests = 0): ListStateView | null {
  if (containers && (containers.length > 0 || requests > 0)) return null;
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

export function deployTone(status: DeployStatus): Tone {
  switch (status) {
    case "deployed":
      return "success";
    case "awaiting_approval":
      return "warning";
    case "pending":
    case "claimed":
    case "deploying":
      return "info";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

export function deployBadge(status: DeployStatus): BadgeView & { live: boolean } {
  return { label: DEPLOYS_LABELS.status[status], tone: deployTone(status), live: status === "deploying" || status === "claimed" };
}

export function isAwaitingApproval(deploy: Pick<HostDeploy, "status">): boolean {
  return deploy.status === "awaiting_approval";
}

export function isActiveDeploy(deploy: Pick<HostDeploy, "status">): boolean {
  return ACTIVE_DEPLOY_STATUSES.includes(deploy.status);
}

export function creationRequests(deploys: readonly HostDeploy[], containers: readonly ServerContainer[] | null): HostDeploy[] {
  const existing = new Set((containers ?? []).map((container) => container.name));
  return sortDeploys(deploys.filter((deploy) => deploy.create && isActiveDeploy(deploy) && !existing.has(deploy.container)));
}

export function sortDeploys(deploys: readonly HostDeploy[]): HostDeploy[] {
  return [...deploys].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function deploysFor(deploys: readonly HostDeploy[], container: string | null | undefined): HostDeploy[] {
  return container ? deploys.filter((deploy) => deploy.container === container) : [...deploys];
}

export function awaitingApprovalCounts(deploys: readonly HostDeploy[] | null): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const deploy of deploys ?? []) {
    if (isAwaitingApproval(deploy)) counts.set(deploy.container, (counts.get(deploy.container) ?? 0) + 1);
  }
  return counts;
}

export function deploySubtitle(deploy: HostDeploy, nowSeconds: number): string {
  const parts = [
    DEPLOYS_LABELS.kinds[deploy.kind],
    deploy.create ? DEPLOYS_LABELS.into(deploy.container) : null,
    DEPLOYS_LABELS.from(deploy.sandbox),
    formatRelativeTime(deploy.createdAt, nowSeconds),
  ];
  return parts.filter(Boolean).join(L.separator);
}

export function newContainerSummary(deploy: Pick<HostDeploy, "cpus" | "memoryMb">): string {
  return DEPLOYS_LABELS.request.newContainer(formatResources(deploy));
}

export function deployRequestEntries(deploy: HostDeploy): KeyValueEntry[] {
  const R = DEPLOYS_LABELS.request;
  const target: KeyValueEntry = deploy.hostname
    ? [R.hostname, R.hostTarget(deploy.hostname, deploy.port)]
    : deploy.port !== null
      ? [R.port, String(deploy.port)]
      : [R.hostname, R.noHostname];
  const entries: KeyValueEntry[] = [[R.source, deploy.sourcePath], [R.size, formatBytes(deploy.bytes)], target];
  return deploy.create ? [[R.container, newContainerSummary(deploy)], ...entries] : entries;
}

export interface DeployRequestView {
  title: string;
  approveLabel: string;
  entries: KeyValueEntry[];
}

export function deployRequestView(deploy: HostDeploy): DeployRequestView {
  return {
    title: deploy.create ? DEPLOYS_LABELS.request.createTitle(deploy.container) : DEPLOYS_LABELS.request.title,
    approveLabel: deploy.create ? DEPLOYS_LABELS.createAndDeploy : DEPLOYS_LABELS.approve,
    entries: deployRequestEntries(deploy),
  };
}

export function approvedMessage(deploy: Pick<HostDeploy, "app" | "container" | "create">): string {
  return deploy.create ? DEPLOYS_LABELS.approvedCreate(deploy.container, deploy.app) : DEPLOYS_LABELS.approved(deploy.app);
}
