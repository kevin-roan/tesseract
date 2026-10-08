import { LIMITS, type AgentRun, type ClaudeSession, type DeleteAgentRuns, type InboxItem, type Project } from "@tesseract/protocol";
import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import {
  ATTENTION_KINDS,
  BADGE_MAX,
  FINAL_STATES,
  NO_PROJECT_KEY,
  SHORT_ID_LENGTH,
  STATE_TONES,
  TERMINAL_SOURCES,
  TITLE_LIMIT,
  type AgentFilter,
} from "./constants";
import { elapsedSeconds, formatDuration, formatRelativeTime, formatTokens, joinMeta, nowSeconds, pluralize } from "./format";
import { AGENTS_LABELS, LIST_LABELS, MANAGE_LABELS, STATE_LABELS } from "./labels";

export type RunState = AgentRun["state"];
export type ProjectNames = Readonly<Record<string, string>>;

const LEADING_NOISE = /^(?:#+\s*|[-*>]\s+|\d+[.)]\s+)/;
const CODE_SPAN = /(`+)([\s\S]+?)\1/g;
const LINK = /\[([^\]\n]+)\]\(\s*<?((?:[^()\s<>]|\([^()\s]*\))+)>?(?:\s+"[^"]*")?\s*\)/g;
const EMPHASIS: readonly RegExp[] = [
  /\*\*(?=\S)(.+?)(?<=\S)\*\*/g,
  /(?<![\w_])__(?=\S)(.+?)(?<=\S)__(?![\w_])/g,
  /(?<![*\w])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?![*\w])/g,
  /(?<![\w_])_(?=[^\s_])(.+?)(?<=[^\s_])_(?![\w_])/g,
  /~~(?=\S)(.+?)(?<=\S)~~/g,
];

export function plainText(text: string): string {
  let stripped = text.replace(CODE_SPAN, (_match, _ticks: string, code: string) => code).replace(LINK, (_match, label: string) => label);
  for (const pattern of EMPHASIS) stripped = stripped.replace(pattern, "$1");
  return stripped;
}

export function runTitle(prompt: string | null | undefined, limit: number = TITLE_LIMIT): string {
  for (const line of (prompt ?? "").split(/\r\n|\r|\n/)) {
    const cleaned = plainText(line.trim().replace(LEADING_NOISE, "")).split(/\s+/).filter(Boolean).join(" ");
    if (cleaned) return cleaned.length <= limit ? cleaned : `${cleaned.slice(0, limit - 1).trimEnd()}…`;
  }
  return AGENTS_LABELS.untitled;
}

export function isFinal(run: Pick<AgentRun, "state"> | null | undefined): boolean {
  return !!run && (FINAL_STATES as readonly string[]).includes(run.state);
}

export function stateTone(state: string): Tone {
  return STATE_TONES[state] ?? "neutral";
}

export function stateLabel(state: string): string {
  return (STATE_LABELS as Record<string, string>)[state] ?? state.charAt(0).toUpperCase() + state.slice(1);
}

export type StateGlyphKind = { kind: "spinner" } | { kind: "icon"; icon: IconName; color: "text-secondary" | "danger" | "text-tertiary" };

export function stateGlyph(state: string): StateGlyphKind {
  if (state === "running") return { kind: "spinner" };
  if (state === "succeeded") return { kind: "icon", icon: "status-done-all", color: "text-secondary" };
  if (state === "failed") return { kind: "icon", icon: "failed", color: "danger" };
  return { kind: "icon", icon: "failed", color: "text-tertiary" };
}

export function projectNames(projects: readonly Pick<Project, "id" | "name">[] | null | undefined): ProjectNames {
  return Object.fromEntries((projects ?? []).map((project) => [project.id, project.name]));
}

export function projectName(projectId: string | null | undefined, names: ProjectNames): string {
  if (!projectId) return AGENTS_LABELS.noProject;
  return names[projectId] ?? projectId;
}

export interface ProjectOption {
  id: string;
  label: string;
}

export function projectOptions(projects: readonly Pick<Project, "id" | "name">[] | null | undefined): ProjectOption[] {
  const sorted = [...(projects ?? [])].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return [{ id: NO_PROJECT_KEY, label: AGENTS_LABELS.noProjectOption }, ...sorted.map((project) => ({ id: project.id, label: project.name }))];
}

export function runTotalTokens(run: Pick<AgentRun, "usage">): number | null {
  return run.usage ? run.usage.totalTokens : null;
}

export function isAttentionItem(item: InboxItem): boolean {
  return (ATTENTION_KINDS as readonly string[]).includes(item.kind);
}

export function isFileItem(item: InboxItem): boolean {
  return item.kind === "file" && !!item.artifactId;
}

export function attentionItems(items: readonly InboxItem[] | null | undefined): InboxItem[] {
  return (items ?? []).filter((item) => isAttentionItem(item) && !item.readAt);
}

export function attentionCards(items: readonly InboxItem[] | null | undefined): InboxItem[] {
  return (items ?? []).filter((item) => (isAttentionItem(item) || isFileItem(item)) && !item.readAt);
}

export const noticeItems = attentionCards;

export function noticeStyle(item: InboxItem): { icon: IconName; tone: Tone } {
  return isFileItem(item) ? { icon: "files", tone: "info" } : { icon: "warning", tone: "warning" };
}

export function attentionForRun(run: Pick<AgentRun, "id" | "sessionId">, items: readonly InboxItem[]): InboxItem[] {
  const session = run.sessionId;
  return items.filter((item) => item.agentRunId === run.id || (!!session && item.sessionId === session && !item.agentRunId));
}

export function matchesQuery(run: AgentRun, query: string, names: ProjectNames): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [run.prompt ?? "", projectName(run.projectId, names), run.result ?? "", run.error ?? "", run.id, run.sessionId ?? ""];
  return haystack.some((value) => value.toLowerCase().includes(needle));
}

export function filterRuns(
  runs: readonly AgentRun[] | null | undefined,
  filter: AgentFilter,
  query = "",
  names: ProjectNames = {},
  attention: readonly InboxItem[] = [],
): AgentRun[] {
  return (runs ?? []).filter((run) => {
    if (filter === "running" && run.state !== "running") return false;
    if (filter === "attention" && attentionForRun(run, attention).length === 0) return false;
    return matchesQuery(run, query, names);
  });
}

export function sortRecent<T extends Pick<AgentRun, "startedAt">>(runs: readonly T[]): T[] {
  return [...runs].sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
}

export function previousRun(run: AgentRun, runs: readonly AgentRun[]): AgentRun | null {
  if (!run.sessionId) return null;
  let best: AgentRun | null = null;
  for (const other of runs) {
    if (other.id === run.id || other.sessionId !== run.sessionId || !(other.startedAt < run.startedAt)) continue;
    if (!best || other.startedAt > best.startedAt) best = other;
  }
  return best;
}

export function isFollowUp(run: AgentRun, runs: readonly AgentRun[]): boolean {
  return previousRun(run, runs) !== null;
}

export function followUpIds(runs: readonly AgentRun[]): Set<string> {
  const earliest = new Map<string, string>();
  for (const run of runs) {
    if (!run.sessionId) continue;
    const current = earliest.get(run.sessionId);
    if (current === undefined || run.startedAt < current) earliest.set(run.sessionId, run.startedAt);
  }
  return new Set(runs.filter((run) => run.sessionId && run.startedAt > earliest.get(run.sessionId)!).map((run) => run.id));
}

export function runDuration(run: Pick<AgentRun, "startedAt" | "endedAt">, now: number = nowSeconds()): string | null {
  const seconds = elapsedSeconds(run.startedAt, run.endedAt, now);
  return seconds === null ? null : formatDuration(seconds);
}

export function rowMeta(run: AgentRun, names: ProjectNames, followUp = false): string {
  return joinMeta(projectName(run.projectId, names), formatTokens(runTotalTokens(run)), followUp ? LIST_LABELS.followUp : null);
}

export function headerMeta(run: AgentRun, names: ProjectNames, now: number = nowSeconds()): string {
  return joinMeta(
    projectName(run.projectId, names),
    formatRelativeTime(run.startedAt, now),
    runDuration(run, now),
    formatTokens(runTotalTokens(run)),
    run.claudeAccountId,
  );
}

export function shortId(value: string | null | undefined, length = SHORT_ID_LENGTH): string {
  return (value ?? "").slice(0, length);
}

export function terminalSessions(sessions: readonly ClaudeSession[] | null | undefined): ClaudeSession[] {
  return (sessions ?? []).filter(
    (session) => (TERMINAL_SOURCES as readonly string[]).includes(session.source) && !!session.terminalId && session.active,
  );
}

export function terminalForRun(run: Pick<AgentRun, "sessionId"> | null | undefined, sessions: readonly ClaudeSession[] | null | undefined): string | null {
  if (!run?.sessionId) return null;
  return (sessions ?? []).find((session) => session.sessionId === run.sessionId && session.terminalId)?.terminalId ?? null;
}

export function terminalSessionMeta(session: ClaudeSession, names: ProjectNames, now: number = nowSeconds()): string {
  return joinMeta(projectName(session.projectId, names), formatRelativeTime(session.lastActiveAt, now), LIST_LABELS.terminalActive);
}

export type FollowUpState = "running" | "no_session" | "ready";

export function followUpState(run: Pick<AgentRun, "state" | "sessionId"> | null | undefined): FollowUpState {
  if (!run || run.state === "running") return "running";
  if (!run.sessionId) return "no_session";
  return "ready";
}

export function badgeCount(runs: readonly Pick<AgentRun, "state">[] | null | undefined, attentionCount = 0): number | null {
  const total = (runs ?? []).filter((run) => run.state === "running").length + (attentionCount || 0);
  return total || null;
}

export function badgeLabel(count: number | null): string | null {
  if (!count) return null;
  return count > BADGE_MAX ? `${BADGE_MAX}+` : String(count);
}

export function upsertRun(runs: readonly AgentRun[] | null | undefined, run: AgentRun): AgentRun[] {
  const current = [...(runs ?? [])];
  const index = current.findIndex((existing) => existing.id === run.id);
  if (index === -1) return [run, ...current];
  const existing = current[index]!;
  const merged = { ...existing, ...run };
  current[index] = isFinal(existing) && run.state === "running" ? { ...merged, state: existing.state, endedAt: existing.endedAt } : merged;
  return current;
}

export function removeRuns(runs: readonly AgentRun[] | null | undefined, ids: readonly string[]): AgentRun[] | null {
  if (!runs) return null;
  const drop = new Set(ids);
  return runs.filter((run) => !drop.has(run.id));
}

export function stripEvents<T extends AgentRun>(run: T & { events?: unknown }): AgentRun {
  const { events: _events, ...rest } = run;
  return rest as AgentRun;
}

export function isArchived(run: Pick<AgentRun, "archivedAt"> | null | undefined): boolean {
  return !!run?.archivedAt;
}

export function canManage(run: Pick<AgentRun, "state"> | null | undefined): boolean {
  return !!run && run.state !== "running";
}

export function finishedIds(runs: readonly AgentRun[] | null | undefined): string[] {
  return (runs ?? []).filter(canManage).map((run) => run.id);
}

export function chunked<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export function deleteBodies(body: DeleteAgentRuns): DeleteAgentRuns[] {
  if (!("ids" in body) || !body.ids) return [body];
  return chunked(body.ids, LIMITS.maxAgentRunBatch).map((ids) => ({ ids }));
}

export type RowAction = "archive" | "unarchive" | "delete";
export type BulkAction = "archive_all" | "delete_all" | "empty_archive";

export function rowActions(state: string, archivedView: boolean): RowAction[] {
  if (state === "running") return [];
  return [archivedView ? "unarchive" : "archive", "delete"];
}

export function bulkActions(runs: readonly AgentRun[] | null | undefined, archivedRuns: readonly AgentRun[] | null | undefined, archivedView: boolean): BulkAction[] {
  if (archivedView) return finishedIds(archivedRuns).length ? ["empty_archive"] : [];
  return finishedIds(runs).length ? ["archive_all", "delete_all"] : [];
}

export function countLabel(count: number): string {
  return pluralize(count, MANAGE_LABELS.noun);
}

export type ListPlaceholder = { title: string; loading: boolean } | null;

export interface ListPlaceholderInput {
  runs: readonly AgentRun[] | null;
  visible: number;
  archivedView: boolean;
  attentionCount: number;
  terminalCount: number;
}

export function listPlaceholder({ runs, visible, archivedView, attentionCount, terminalCount }: ListPlaceholderInput): ListPlaceholder {
  if (runs === null) return { title: LIST_LABELS.loading, loading: true };
  if (archivedView && runs.length === 0) return { title: LIST_LABELS.archivedEmptyTitle, loading: false };
  if (runs.length === 0) return attentionCount === 0 && terminalCount === 0 ? { title: LIST_LABELS.emptyTitle, loading: false } : null;
  if (visible === 0 && attentionCount === 0) return { title: LIST_LABELS.noMatchTitle, loading: false };
  return null;
}

export type AttentionOpen = { kind: "file"; artifactId: string; projectId: string | null } | { kind: "run"; runId: string } | { kind: "terminal"; terminalId: string } | null;

export function attentionOpenTarget(item: InboxItem): AttentionOpen {
  if (isFileItem(item)) return { kind: "file", artifactId: item.artifactId!, projectId: item.projectId };
  if (item.agentRunId) return { kind: "run", runId: item.agentRunId };
  if (item.terminalId) return { kind: "terminal", terminalId: item.terminalId };
  return null;
}

export function attentionMeta(item: InboxItem, names: ProjectNames): string {
  return joinMeta(item.projectId ? projectName(item.projectId, names) : null, item.body);
}

export function listWidth(pageWidth: number, bounds: { min: number; fraction: number; max: number }): number {
  return Math.round(Math.min(bounds.max, Math.max(bounds.min, pageWidth * bounds.fraction)));
}
