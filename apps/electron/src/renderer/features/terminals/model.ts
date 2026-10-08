import type { Project, TerminalInfo, TerminalKind } from "@tesseract/protocol";
import type { ConnectionStatus } from "../../app/connection";
import type { IconName } from "../../theme/icons";
import {
  CONNECTION_EMPTY_ICONS,
  DEFAULT_KIND_ICON,
  ESTIMATE_CELL,
  FALLBACK_GRID,
  FONT_SIZE,
  INPUT_QUEUE_CAP,
  INPUT_STATES,
  KIND_ICONS,
  RELATIVE_SECONDS,
  SPLIT,
  STATE_TONES,
  TERMINAL_KINDS,
  TERMINAL_PADDING_PX,
} from "./constants";
import {
  BANNER_LABELS,
  CONNECTION_EMPTY_LABELS,
  ERROR_PLACEHOLDER,
  KIND_LABELS,
  META_LABELS,
  RELATIVE_LABELS,
  STATE_LABELS,
  TERMINALS_LABELS,
  type ConnectionEmptyLabel,
} from "./labels";
import type { BadgeModel, BannerModel, Grid, LiveSession, OpenRequest, SessionRowModel, SessionState, TerminalCommand } from "./types";

export function parseOpen(params: Record<string, unknown> | null | undefined): OpenRequest | null {
  if (!params) return null;
  const { terminalId, kind, projectId } = params;
  if (typeof terminalId === "string" && terminalId) return { type: "attach", terminalId };
  if ((TERMINAL_KINDS as readonly unknown[]).includes(kind)) {
    return { type: "launch", kind: kind as TerminalKind, projectId: typeof projectId === "string" && projectId ? projectId : null };
  }
  return null;
}

export function sortSessions(terminals: readonly TerminalInfo[]): TerminalInfo[] {
  return [...terminals].sort((a, b) => {
    const running = Number(b.state === "running") - Number(a.state === "running");
    if (running !== 0) return running;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
}

export function runningCount(terminals: readonly TerminalInfo[]): number {
  return terminals.filter((terminal) => terminal.state === "running").length;
}

const titleCase = (value: string) => value.replace(/\b\w/g, (letter) => letter.toUpperCase());

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? titleCase(kind);
}

export function kindIcon(kind: string) {
  return KIND_ICONS[kind] ?? DEFAULT_KIND_ICON;
}

export function projectLabel(projectId: string | null | undefined, projects: readonly Project[] | null | undefined): string {
  if (!projectId) return TERMINALS_LABELS.workspace;
  const project = projects?.find((candidate) => candidate.id === projectId);
  return project?.name || projectId;
}

export function sessionTitle(info: Pick<TerminalInfo, "kind" | "projectId">, projects: readonly Project[] | null | undefined): string {
  return `${kindLabel(info.kind)}${META_LABELS.separator}${projectLabel(info.projectId, projects)}`;
}

export function relativeTime(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "";
  const moment = Date.parse(iso);
  if (Number.isNaN(moment)) return "";
  const seconds = Math.floor((nowMs - moment) / 1000);
  if (seconds < RELATIVE_SECONDS.justNow) return RELATIVE_LABELS.justNow;
  if (seconds < RELATIVE_SECONDS.hour) return RELATIVE_LABELS.minutes(Math.max(1, Math.floor(seconds / RELATIVE_SECONDS.minute + 0.5)));
  if (seconds < RELATIVE_SECONDS.day) return RELATIVE_LABELS.hours(Math.floor(seconds / RELATIVE_SECONDS.hour));
  if (seconds < RELATIVE_SECONDS.week) return RELATIVE_LABELS.days(Math.floor(seconds / RELATIVE_SECONDS.day));
  return new Date(moment).toISOString().slice(0, 10);
}

export function sessionSubtitle(info: TerminalInfo, nowMs: number): string {
  const when = relativeTime(info.createdAt, nowMs);
  const sized = info.state === "running" && info.cols > 0 && info.rows > 0;
  return [when ? META_LABELS.started(when) : null, sized ? META_LABELS.size(info.cols, info.rows) : null]
    .filter((part): part is string => Boolean(part))
    .join(META_LABELS.separator);
}

export function exitLabel(code: number | null | undefined): string {
  return code === null || code === undefined ? STATE_LABELS.exited : STATE_LABELS.exitedCode(code);
}

export function stateBadge(state: SessionState, exitCode: number | null = null): BadgeModel {
  return { label: state === "exited" ? exitLabel(exitCode) : STATE_LABELS[state], tone: STATE_TONES[state] };
}

export function infoStatus(info: TerminalInfo): BadgeModel {
  return info.state === "exited" ? { label: exitLabel(info.exitCode), tone: "neutral" } : { label: STATE_LABELS.running, tone: "success" };
}

export function rowModel(info: TerminalInfo, projects: readonly Project[] | null | undefined, nowMs: number, live?: LiveSession | null): SessionRowModel {
  const status = live ? stateBadge(live.state, live.exitCode) : infoStatus(info);
  const running = live ? live.state !== "exited" : info.state === "running";
  return {
    id: info.id,
    icon: kindIcon(info.kind),
    title: sessionTitle(info, projects),
    subtitle: sessionSubtitle(info, nowMs),
    status: status.label,
    tone: status.tone,
    running,
  };
}

export function bannerFor(live: Pick<LiveSession, "state" | "exitCode" | "error"> | null | undefined): BannerModel | null {
  if (!live) return null;
  switch (live.state) {
    case "exited":
      return {
        title: BANNER_LABELS.exitedTitle,
        message: live.exitCode === null ? BANNER_LABELS.exitedUnknown : BANNER_LABELS.exited(live.exitCode),
        tone: live.exitCode ? "danger" : "neutral",
        action: "restart",
      };
    case "closed":
      return { title: BANNER_LABELS.closedTitle, message: BANNER_LABELS.closed(live.error ?? ""), tone: "danger", action: "reconnect" };
    case "reconnecting":
      return { title: BANNER_LABELS.reconnectingTitle, message: BANNER_LABELS.reconnecting, tone: "warning", action: null };
    default:
      return null;
  }
}

export function inputEnabled(state: SessionState): boolean {
  return INPUT_STATES.includes(state);
}

export function mapSocketState(socket: "connecting" | "open" | "closed", everOpen: boolean): SessionState {
  if (socket === "open") return "open";
  if (socket === "closed") return "closed";
  return everOpen ? "reconnecting" : "connecting";
}

export function isCollapsed(pageWidth: number | null): boolean {
  return pageWidth !== null && pageWidth <= SPLIT.collapseAt;
}

export function sidebarWidth(pageWidth: number | null): number {
  if (pageWidth === null) return SPLIT.observed;
  return Math.min(SPLIT.maxSidebar, Math.max(SPLIT.minSidebar, Math.min(SPLIT.observed, pageWidth - SPLIT.minContent)));
}

export function estimateGrid(width: number, height: number): Grid {
  if (width <= 0 || height <= 0) return { ...FALLBACK_GRID };
  const inner = TERMINAL_PADDING_PX * 2;
  return {
    cols: Math.max(2, Math.floor((width - inner) / ESTIMATE_CELL.width)),
    rows: Math.max(1, Math.floor((height - inner) / ESTIMATE_CELL.height)),
  };
}

export function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Math.round(size)));
}

export function nextSelection(order: readonly string[], attached: readonly string[], removedId: string): string | null {
  const candidates = order.filter((id) => id !== removedId && attached.includes(id));
  if (candidates.length === 0) return null;
  const index = order.indexOf(removedId);
  if (index === -1) return candidates[0] ?? null;
  return order.slice(index + 1).find((id) => candidates.includes(id)) ?? candidates[candidates.length - 1] ?? null;
}

export function touchAttached(order: readonly string[], id: string, current: string | null, max: number): { order: string[]; evicted: string[] } {
  const next = [...order.filter((candidate) => candidate !== id), id];
  const evicted: string[] = [];
  while (next.length > max) {
    const victim = next.find((candidate) => candidate !== current && candidate !== id);
    if (victim === undefined) break;
    next.splice(next.indexOf(victim), 1);
    evicted.push(victim);
  }
  return { order: next, evicted };
}

export function connectionEmpty(status: ConnectionStatus, error: string | null): (ConnectionEmptyLabel & { loading: boolean; icon: IconName }) | null {
  if (status === "online") return null;
  const entry = CONNECTION_EMPTY_LABELS[status];
  return {
    ...entry,
    message: entry.message === null ? null : entry.message.replace(ERROR_PLACEHOLDER, error ?? "").trim() || null,
    loading: status === "discovering" || status === "connecting",
    icon: CONNECTION_EMPTY_ICONS[status],
  };
}

export interface KeyLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  type: string;
}

export function keyCommand(event: KeyLike): TerminalCommand | null {
  if (event.type !== "keydown") return null;
  const { ctrlKey: ctrl, shiftKey: shift, altKey: alt, metaKey: meta } = event;
  if (alt || meta) return null;
  const key = event.key.toLowerCase();
  if (ctrl && shift) {
    if (key === "c") return "copy";
    if (key === "v") return "paste";
    if (event.key === "Home") return "scrollTop";
    if (event.key === "End") return "scrollBottom";
    if (event.key === "+") return "zoomIn";
  }
  if (!ctrl && shift) {
    if (event.key === "PageUp") return "pageUp";
    if (event.key === "PageDown") return "pageDown";
    if (event.key === "Enter") return "shiftEnter";
  }
  if (ctrl) {
    if (event.key === "=" || event.key === "+" || event.code === "NumpadAdd") return "zoomIn";
    if (event.key === "-" || event.code === "NumpadSubtract") return "zoomOut";
    if (!shift && (event.key === "0" || event.code === "Numpad0")) return "zoomReset";
  }
  return null;
}

export class InputQueue {
  private items: string[] = [];
  private size = 0;

  constructor(private readonly cap = INPUT_QUEUE_CAP) {}

  get length(): number {
    return this.size;
  }

  push(data: string): boolean {
    if (this.size + data.length > this.cap) return false;
    this.items.push(data);
    this.size += data.length;
    return true;
  }

  drain(): string[] {
    const items = this.items;
    this.items = [];
    this.size = 0;
    return items;
  }

  clear(): void {
    this.items = [];
    this.size = 0;
  }
}

export function truncateName(name: string, max: number): string {
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}

export function isLinkActivation(event: Pick<MouseEvent, "button" | "ctrlKey" | "metaKey">): boolean {
  return event.button === 0 && (event.ctrlKey || event.metaKey);
}
