import type { InboxItem, InboxKind } from "@tesseract/protocol";

export type InboxSectionId = "attention" | "unread" | "earlier";

export type InboxSection = { id: InboxSectionId; title: string; items: InboxItem[] };

const SECTION_TITLES: Record<InboxSectionId, string> = {
  attention: "Needs you",
  unread: "Unread",
  earlier: "Earlier",
};

const ATTENTION_KINDS: readonly InboxKind[] = ["needs_input", "permission"];

export const isAttentionKind = (kind: InboxKind): boolean => ATTENTION_KINDS.includes(kind);

export const isUnread = (item: Pick<InboxItem, "readAt">): boolean => item.readAt === null;

export const needsAttention = (item: Pick<InboxItem, "kind" | "readAt">): boolean =>
  isUnread(item) && isAttentionKind(item.kind);

function time(iso: string): number {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

export function sortInbox(items: readonly InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
}

export function groupInbox(items: readonly InboxItem[]): InboxSection[] {
  const buckets: Record<InboxSectionId, InboxItem[]> = { attention: [], unread: [], earlier: [] };
  for (const item of sortInbox(items)) {
    if (needsAttention(item)) buckets.attention.push(item);
    else if (isUnread(item)) buckets.unread.push(item);
    else buckets.earlier.push(item);
  }
  return (Object.keys(buckets) as InboxSectionId[])
    .filter((id) => buckets[id].length > 0)
    .map((id) => ({ id, title: SECTION_TITLES[id], items: buckets[id] }));
}

export function upsertInboxItem(items: readonly InboxItem[], item: InboxItem): InboxItem[] {
  return sortInbox([item, ...items.filter((entry) => entry.id !== item.id)]);
}

export function markItemsRead(items: readonly InboxItem[], ids: readonly string[] | "all", readAt: string): InboxItem[] {
  const targets = ids === "all" ? null : new Set(ids);
  return items.map((item) =>
    item.readAt === null && (targets === null || targets.has(item.id)) ? { ...item, readAt } : item,
  );
}

export type InboxTarget =
  | { kind: "file"; id: string }
  | { kind: "agentRun"; id: string }
  | { kind: "terminal"; id: string }
  | { kind: "chat"; id: string }
  | { kind: "project"; id: string };

export function inboxTarget(
  item: Pick<InboxItem, "artifactId" | "agentRunId" | "terminalId" | "sessionId" | "projectId">,
): InboxTarget | null {
  if (item.artifactId) return { kind: "file", id: item.artifactId };
  if (item.agentRunId) return { kind: "agentRun", id: item.agentRunId };
  if (item.terminalId) return { kind: "terminal", id: item.terminalId };
  if (item.sessionId) return { kind: "chat", id: item.sessionId };
  if (item.projectId) return { kind: "project", id: item.projectId };
  return null;
}

export function attentionTitle(attentionCount: number): string | null {
  if (attentionCount <= 0) return null;
  return attentionCount === 1 ? "1 request needs you" : `${attentionCount} requests need you`;
}

export const ALL_INBOX_PROJECTS = "all";

export type InboxProjectOption = { value: string; label: string };

/** "All" plus one segment per project in the inbox, by name; empty when there is nothing to choose between. */
export function inboxProjectOptions(
  items: readonly Pick<InboxItem, "projectId">[],
  names: ReadonlyMap<string, string>,
): InboxProjectOption[] {
  const ids = [...new Set(items.flatMap((item) => (item.projectId ? [item.projectId] : [])))];
  if (ids.length < 2) return [];
  const options = ids
    .map((id) => ({ value: id, label: names.get(id) ?? id }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [{ value: ALL_INBOX_PROJECTS, label: "All" }, ...options];
}

export function filterInboxByProject<T extends Pick<InboxItem, "projectId">>(items: readonly T[], projectId: string): T[] {
  return projectId === ALL_INBOX_PROJECTS ? [...items] : items.filter((item) => item.projectId === projectId);
}
