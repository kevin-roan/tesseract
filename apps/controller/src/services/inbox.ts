import {
  createId,
  LIMITS,
  type AgentRun,
  type Inbox,
  type InboxCounts,
  type InboxItem,
  type InboxKind,
  type InboxQuery,
  type MarkInboxRead,
} from "@tesseract/protocol";
import { nowIso } from "../core/time";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";

export const INBOX_KEEP = 1_000;
export const SNIPPET_CHARS = 280;

const ATTENTION_KINDS = ["needs_input", "permission"] as const satisfies readonly InboxKind[];
const OUTCOME_KINDS = ["completed", "failed"] as const satisfies readonly InboxKind[];

export type InboxEntry = {
  kind: InboxKind;
  title: string;
  body: string;
  projectId?: string | null;
  sessionId?: string | null;
  agentRunId?: string | null;
  terminalId?: string | null;
  artifactId?: string | null;
};

export type InboxLink = { sessionId: string | null; agentRunId: string | null };

export function snippet(text: string, max = SNIPPET_CHARS): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

const isOutcome = (kind: InboxKind) => (OUTCOME_KINDS as readonly InboxKind[]).includes(kind);
const dedupeKinds = (kind: InboxKind): readonly InboxKind[] => (kind === "file" ? [] : isOutcome(kind) ? OUTCOME_KINDS : [kind]);
const isTruthy = (flag: InboxQuery["unread"]) => flag === "1" || flag === "true";

/**
 * Notifications for the phone. A repeat of an unread item (same kind and session or agent run)
 * bumps it instead of adding a row; `completed` and `failed` count as the same kind so a run's
 * outcome and the Stop hook of its session end up in one item. `file` items are never bumped:
 * every shared file gets its own row.
 */
export class InboxService {
  private readonly runningRuns = new Set<string>();

  constructor(
    private readonly repos: Repositories,
    private readonly hub: EventHub,
    private readonly logger: Logger,
    private readonly keep: number = INBOX_KEEP,
  ) {}

  add(entry: InboxEntry): InboxItem {
    const now = nowIso();
    const link: InboxLink = { sessionId: entry.sessionId ?? null, agentRunId: entry.agentRunId ?? null };
    const existing = this.repos.unreadInboxFor(dedupeKinds(entry.kind), link)[0];
    const previous = existing ?? (link.sessionId ? this.repos.latestInboxForSession(link.sessionId) : null);
    const item: InboxItem = {
      id: existing?.id ?? createId("inbox"),
      kind: entry.kind,
      title: entry.title,
      body: entry.body,
      projectId: entry.projectId ?? previous?.projectId ?? null,
      sessionId: link.sessionId ?? existing?.sessionId ?? null,
      agentRunId: link.agentRunId ?? existing?.agentRunId ?? null,
      terminalId: entry.terminalId ?? previous?.terminalId ?? null,
      artifactId: entry.artifactId ?? existing?.artifactId ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      readAt: null,
    };
    this.repos.inbox.save(item);
    if (!existing) {
      const pruned = this.repos.pruneInbox(this.keep);
      if (pruned > 0) this.logger.debug("pruned inbox", { count: pruned });
    }
    this.publish(item);
    return { ...item };
  }

  /** Claude is no longer blocked on this session or run: its unread `needs_input`/`permission` items become read. */
  clearAttention(link: InboxLink): number {
    const ids = this.repos.unreadInboxFor(ATTENTION_KINDS, link).map((item) => item.id);
    return this.markIds(ids);
  }

  list(query: InboxQuery = {}): Inbox {
    const items = this.repos.inboxItems({ limit: query.limit ?? LIMITS.defaultInboxList, unread: isTruthy(query.unread) });
    return { items, ...this.counts() };
  }

  markRead(input: MarkInboxRead): InboxCounts {
    if ("all" in input) {
      if (this.repos.markInboxRead(nowIso(), { all: true }) > 0) this.publish();
    } else {
      this.markIds(input.ids);
    }
    return this.counts();
  }

  counts(): InboxCounts {
    return this.repos.inboxCounts();
  }

  /**
   * Adds `completed`/`failed` when a run seen running ends; a cancelled run only clears attention.
   * Later updates of finished runs (archiving) are ignored.
   */
  follow(hub: EventHub): () => void {
    return hub.subscribe((event) => {
      if (event.type !== "agent.updated") return;
      if (event.run.state === "running") this.runningRuns.add(event.run.id);
      else if (this.runningRuns.delete(event.run.id)) this.agentRunEnded(event.run);
    });
  }

  private agentRunEnded(run: AgentRun): void {
    const link: InboxLink = { sessionId: run.sessionId, agentRunId: run.id };
    this.clearAttention(link);
    if (run.state === "cancelled") return;
    const kind: InboxKind = run.state === "succeeded" ? "completed" : "failed";
    const reported = this.repos.inbox.where("agent_run_id = ? AND kind = ? AND read_at IS NOT NULL", run.id, kind);
    if (reported.length > 0) return;
    const text = kind === "completed" ? (run.result ?? "") : (run.error ?? "");
    this.add({
      kind,
      title: kind === "completed" ? "Claude finished" : "Claude run failed",
      body: snippet(text) || snippet(run.prompt),
      projectId: run.projectId,
      sessionId: run.sessionId,
      agentRunId: run.id,
    });
  }

  private markIds(ids: readonly string[]): number {
    const changed = this.repos.markInboxRead(nowIso(), { ids });
    if (changed > 0) this.publish();
    return changed;
  }

  private publish(item?: InboxItem): void {
    this.hub.publish({ type: "inbox.updated", ...(item ? { item: { ...item } } : {}), ...this.counts() });
  }
}
