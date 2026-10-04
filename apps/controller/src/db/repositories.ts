import type { Database, SQLQueryBindings } from "bun:sqlite";
import type {
  AgentRun,
  AgentRunEvent,
  AgentRunMode,
  AgentRunState,
  AgentRunUsage,
  Artifact,
  ArtifactSource,
  BuildJob,
  BuildProfile,
  BuildState,
  BuildTarget,
  InboxCounts,
  InboxItem,
  InboxKind,
  LiveActivityToken,
  LiveActivityTokenKind,
  ProcessCommand,
  ProcessInfo,
  ProcessState,
  PushDevice,
  PushPlatform,
  SyncRequest,
  SyncRequestKind,
  SyncRequestSource,
  SyncRequestStatus,
  SyncResult,
  TerminalInfo,
  TerminalKind,
  TerminalState,
  Upload,
  UploadKind,
} from "@theone/protocol";

type Row = Record<string, unknown>;
type Binding = string | number | null;
type Columns<T> = Record<string, (entity: T) => Binding>;

const DEFAULT_LIST_LIMIT = 200;

const text = (row: Row, key: string): string => String(row[key] ?? "");
const textOrNull = (row: Row, key: string): string | null => (row[key] == null ? null : String(row[key]));
const numOrNull = (row: Row, key: string): number | null => (row[key] == null ? null : Number(row[key]));
const num = (row: Row, key: string): number => Number(row[key] ?? 0);
const agentRunUsage = (row: Row): AgentRunUsage | null => {
  if (row.input_tokens == null) return null;
  const inputTokens = num(row, "input_tokens");
  const outputTokens = num(row, "output_tokens");
  const cacheReadTokens = num(row, "cache_read_tokens");
  const cacheWriteTokens = num(row, "cache_write_tokens");
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens };
};
const jsonList = <T>(row: Row, key: string): T[] => (row[key] == null ? [] : (JSON.parse(String(row[key])) as T[]));

class Table<T extends { id: string }> {
  private readonly upsertSql: string;

  constructor(
    private readonly db: Database,
    private readonly table: string,
    private readonly columns: Columns<T>,
    private readonly fromRow: (row: Row) => T,
    private readonly orderBy: string,
  ) {
    const names = Object.keys(columns);
    const updates = names.filter((name) => name !== "id").map((name) => `${name} = excluded.${name}`);
    this.upsertSql = `INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map((n) => `$${n}`).join(", ")})
      ON CONFLICT(id) DO UPDATE SET ${updates.join(", ")}`;
  }

  save(entity: T): void {
    const params: Record<string, Binding> = {};
    for (const [name, get] of Object.entries(this.columns)) params[name] = get(entity);
    this.db.query(this.upsertSql).run(params as SQLQueryBindings);
  }

  get(id: string): T | null {
    const row = this.db.query<Row, [string]>(`SELECT * FROM ${this.table} WHERE id = ?`).get(id);
    return row ? this.fromRow(row) : null;
  }

  list(filter: { projectId?: string; limit?: number; where?: string } = {}): T[] {
    const clauses = [filter.where, filter.projectId === undefined ? undefined : "project_id = ?"].filter((clause) => clause !== undefined);
    const params: Binding[] = filter.projectId === undefined ? [] : [filter.projectId];
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")} ` : "";
    return this.db
      .query<Row, Binding[]>(`SELECT * FROM ${this.table} ${where}ORDER BY ${this.orderBy} DESC, rowid DESC LIMIT ?`)
      .all(...params, filter.limit ?? DEFAULT_LIST_LIMIT)
      .map(this.fromRow);
  }

  where(sql: string, ...params: Binding[]): T[] {
    return this.db
      .query<Row, Binding[]>(`SELECT * FROM ${this.table} WHERE ${sql} ORDER BY ${this.orderBy} DESC, rowid DESC`)
      .all(...params)
      .map(this.fromRow);
  }

  update(set: string, sql: string, ...params: Binding[]): T[] {
    return this.db
      .query<Row, Binding[]>(`UPDATE ${this.table} SET ${set} WHERE ${sql} RETURNING *`)
      .all(...params)
      .map(this.fromRow);
  }

  delete(sql: string, ...params: Binding[]): T[] {
    return this.db
      .query<Row, Binding[]>(`DELETE FROM ${this.table} WHERE ${sql} RETURNING *`)
      .all(...params)
      .map(this.fromRow);
  }
}

export type BuildRecord = Omit<BuildJob, "artifacts">;

export type AgentRunTarget = { ids: readonly string[] } | { all: true; projectId?: string; archived?: boolean };

const placeholders = (values: readonly unknown[]) => values.map(() => "?").join(", ");

function agentRunClause(target: AgentRunTarget, skip: readonly string[]): { sql: string; params: Binding[] } {
  const clauses = ["state != 'running'"];
  const params: Binding[] = [];
  if ("ids" in target) {
    clauses.push(`id IN (${placeholders(target.ids)})`);
    params.push(...target.ids);
  } else {
    if (target.projectId !== undefined) {
      clauses.push("project_id = ?");
      params.push(target.projectId);
    }
    if (target.archived !== undefined) clauses.push(target.archived ? "archived_at IS NOT NULL" : "archived_at IS NULL");
  }
  if (skip.length > 0) {
    clauses.push(`id NOT IN (${placeholders(skip)})`);
    params.push(...skip);
  }
  return { sql: clauses.join(" AND "), params };
}

const ATTENTION_KINDS = "('needs_input', 'permission')";

const pushDeviceFromRow = (row: Row): PushDevice => ({
  token: text(row, "token"),
  platform: text(row, "platform") as PushPlatform,
  name: textOrNull(row, "name"),
  createdAt: text(row, "created_at"),
  updatedAt: text(row, "updated_at"),
});

const liveActivityTokenFromRow = (row: Row): LiveActivityToken => ({
  token: text(row, "token"),
  kind: text(row, "kind") as LiveActivityTokenKind,
  activityId: textOrNull(row, "activity_id"),
  createdAt: text(row, "created_at"),
  updatedAt: text(row, "updated_at"),
});

export class Repositories {
  readonly processes: Table<ProcessInfo>;
  readonly terminals: Table<TerminalInfo>;
  readonly builds: Table<BuildRecord>;
  readonly artifacts: Table<Artifact>;
  readonly agentRuns: Table<AgentRun>;
  readonly inbox: Table<InboxItem>;
  readonly uploads: Table<Upload>;
  readonly syncRequests: Table<SyncRequest>;

  constructor(private readonly db: Database) {
    this.processes = new Table<ProcessInfo>(
      db,
      "processes",
      {
        id: (p) => p.id,
        project_id: (p) => p.projectId,
        name: (p) => p.name,
        command: (p) => JSON.stringify(p.command),
        cwd: (p) => p.cwd,
        pid: (p) => p.pid,
        port: (p) => p.port,
        display: (p) => (p.display ? 1 : 0),
        state: (p) => p.state,
        exit_code: (p) => p.exitCode,
        started_at: (p) => p.startedAt,
        ended_at: (p) => p.endedAt,
      },
      (row) => ({
        id: text(row, "id"),
        projectId: textOrNull(row, "project_id"),
        name: text(row, "name"),
        command: JSON.parse(text(row, "command")) as ProcessCommand,
        cwd: text(row, "cwd"),
        pid: numOrNull(row, "pid"),
        port: numOrNull(row, "port"),
        display: num(row, "display") === 1,
        state: text(row, "state") as ProcessState,
        exitCode: numOrNull(row, "exit_code"),
        startedAt: text(row, "started_at"),
        endedAt: textOrNull(row, "ended_at"),
      }),
      "started_at",
    );

    this.terminals = new Table<TerminalInfo>(
      db,
      "terminals",
      {
        id: (t) => t.id,
        kind: (t) => t.kind,
        project_id: (t) => t.projectId,
        title: (t) => t.title,
        cwd: (t) => t.cwd,
        pid: (t) => t.pid,
        cols: (t) => t.cols,
        rows: (t) => t.rows,
        state: (t) => t.state,
        exit_code: (t) => t.exitCode,
        created_at: (t) => t.createdAt,
      },
      (row) => ({
        id: text(row, "id"),
        kind: text(row, "kind") as TerminalKind,
        projectId: textOrNull(row, "project_id"),
        title: text(row, "title"),
        cwd: text(row, "cwd"),
        pid: numOrNull(row, "pid"),
        cols: num(row, "cols"),
        rows: num(row, "rows"),
        state: text(row, "state") as TerminalState,
        exitCode: numOrNull(row, "exit_code"),
        createdAt: text(row, "created_at"),
      }),
      "created_at",
    );

    this.builds = new Table<BuildRecord>(
      db,
      "builds",
      {
        id: (b) => b.id,
        project_id: (b) => b.projectId,
        target: (b) => b.target,
        profile: (b) => b.profile,
        state: (b) => b.state,
        stage: (b) => b.stage,
        progress: (b) => b.progress,
        started_at: (b) => b.startedAt,
        ended_at: (b) => b.endedAt,
        created_at: (b) => b.createdAt,
        error: (b) => b.error,
      },
      (row) => ({
        id: text(row, "id"),
        projectId: text(row, "project_id"),
        target: text(row, "target") as BuildTarget,
        profile: text(row, "profile") as BuildProfile,
        state: text(row, "state") as BuildState,
        stage: textOrNull(row, "stage"),
        progress: numOrNull(row, "progress"),
        startedAt: textOrNull(row, "started_at"),
        endedAt: textOrNull(row, "ended_at"),
        createdAt: text(row, "created_at"),
        error: textOrNull(row, "error"),
      }),
      "created_at",
    );

    this.artifacts = new Table<Artifact>(
      db,
      "artifacts",
      {
        id: (a) => a.id,
        project_id: (a) => a.projectId,
        build_id: (a) => a.buildId,
        file_name: (a) => a.fileName,
        path: (a) => a.path,
        size_bytes: (a) => a.sizeBytes,
        sha256: (a) => a.sha256,
        platform: (a) => a.platform,
        source: (a) => a.source,
        agent_run_id: (a) => a.agentRunId,
        note: (a) => a.note,
        created_at: (a) => a.createdAt,
      },
      (row) => ({
        id: text(row, "id"),
        projectId: text(row, "project_id"),
        buildId: textOrNull(row, "build_id"),
        fileName: text(row, "file_name"),
        path: text(row, "path"),
        sizeBytes: num(row, "size_bytes"),
        sha256: text(row, "sha256"),
        platform: text(row, "platform"),
        source: text(row, "source") as ArtifactSource,
        agentRunId: textOrNull(row, "agent_run_id"),
        note: textOrNull(row, "note"),
        createdAt: text(row, "created_at"),
      }),
      "created_at",
    );

    this.agentRuns = new Table<AgentRun>(
      db,
      "agent_runs",
      {
        id: (r) => r.id,
        project_id: (r) => r.projectId,
        prompt: (r) => r.prompt,
        mode: (r) => r.mode,
        attachments: (r) => (r.attachments.length > 0 ? JSON.stringify(r.attachments) : null),
        session_id: (r) => r.sessionId,
        claude_account_id: (r) => r.claudeAccountId,
        state: (r) => r.state,
        started_at: (r) => r.startedAt,
        ended_at: (r) => r.endedAt,
        input_tokens: (r) => r.usage?.inputTokens ?? null,
        output_tokens: (r) => r.usage?.outputTokens ?? null,
        cache_read_tokens: (r) => r.usage?.cacheReadTokens ?? null,
        cache_write_tokens: (r) => r.usage?.cacheWriteTokens ?? null,
        result: (r) => r.result,
        error: (r) => r.error,
        archived_at: (r) => r.archivedAt,
      },
      (row) => ({
        id: text(row, "id"),
        projectId: textOrNull(row, "project_id"),
        prompt: text(row, "prompt"),
        mode: textOrNull(row, "mode") as AgentRunMode | null,
        attachments: jsonList<Upload>(row, "attachments"),
        sessionId: textOrNull(row, "session_id"),
        claudeAccountId: textOrNull(row, "claude_account_id"),
        state: text(row, "state") as AgentRunState,
        startedAt: text(row, "started_at"),
        endedAt: textOrNull(row, "ended_at"),
        usage: agentRunUsage(row),
        result: textOrNull(row, "result"),
        error: textOrNull(row, "error"),
        archivedAt: textOrNull(row, "archived_at"),
      }),
      "started_at",
    );

    this.inbox = new Table<InboxItem>(
      db,
      "inbox",
      {
        id: (i) => i.id,
        kind: (i) => i.kind,
        title: (i) => i.title,
        body: (i) => i.body,
        project_id: (i) => i.projectId,
        session_id: (i) => i.sessionId,
        agent_run_id: (i) => i.agentRunId,
        terminal_id: (i) => i.terminalId,
        artifact_id: (i) => i.artifactId,
        created_at: (i) => i.createdAt,
        updated_at: (i) => i.updatedAt,
        read_at: (i) => i.readAt,
      },
      (row) => ({
        id: text(row, "id"),
        kind: text(row, "kind") as InboxKind,
        title: text(row, "title"),
        body: text(row, "body"),
        projectId: textOrNull(row, "project_id"),
        sessionId: textOrNull(row, "session_id"),
        agentRunId: textOrNull(row, "agent_run_id"),
        terminalId: textOrNull(row, "terminal_id"),
        artifactId: textOrNull(row, "artifact_id"),
        createdAt: text(row, "created_at"),
        updatedAt: text(row, "updated_at"),
        readAt: textOrNull(row, "read_at"),
      }),
      "updated_at",
    );

    this.uploads = new Table<Upload>(
      db,
      "uploads",
      {
        id: (u) => u.id,
        name: (u) => u.name,
        mime_type: (u) => u.mimeType,
        kind: (u) => u.kind,
        size_bytes: (u) => u.sizeBytes,
        path: (u) => u.path,
        created_at: (u) => u.createdAt,
      },
      (row) => ({
        id: text(row, "id"),
        name: text(row, "name"),
        mimeType: text(row, "mime_type"),
        kind: text(row, "kind") as UploadKind,
        sizeBytes: num(row, "size_bytes"),
        path: text(row, "path"),
        createdAt: text(row, "created_at"),
      }),
      "created_at",
    );

    this.syncRequests = new Table<SyncRequest>(
      db,
      "sync_requests",
      {
        id: (r) => r.id,
        project_id: (r) => r.projectId,
        kind: (r) => r.kind,
        status: (r) => r.status,
        paths: (r) => (r.paths === null ? null : JSON.stringify(r.paths)),
        force: (r) => (r.force ? 1 : 0),
        source: (r) => r.source,
        claimed_by: (r) => r.claimedBy,
        result: (r) => (r.result === null ? null : JSON.stringify(r.result)),
        error: (r) => r.error,
        created_at: (r) => r.createdAt,
        updated_at: (r) => r.updatedAt,
      },
      (row) => ({
        id: text(row, "id"),
        projectId: text(row, "project_id"),
        kind: text(row, "kind") as SyncRequestKind,
        status: text(row, "status") as SyncRequestStatus,
        paths: row.paths == null ? null : jsonList<string>(row, "paths"),
        force: num(row, "force") === 1,
        source: text(row, "source") as SyncRequestSource,
        claimedBy: textOrNull(row, "claimed_by"),
        result: row.result == null ? null : (JSON.parse(String(row.result)) as SyncResult),
        error: textOrNull(row, "error"),
        createdAt: text(row, "created_at"),
        updatedAt: text(row, "updated_at"),
      }),
      "created_at",
    );
  }

  pruneSyncRequests(keep: number): number {
    return this.db
      .query("DELETE FROM sync_requests WHERE id NOT IN (SELECT id FROM sync_requests ORDER BY created_at DESC, rowid DESC LIMIT ?)")
      .run(keep).changes;
  }

  /** Removes upload rows created before `before`; returns them so their files can be deleted. */
  deleteUploadsBefore(before: string): Upload[] {
    return this.uploads.delete("created_at < ?", before);
  }

  inboxItems(filter: { limit: number; unread: boolean }): InboxItem[] {
    return filter.unread
      ? this.inbox.where("read_at IS NULL").slice(0, filter.limit)
      : this.inbox.list({ limit: filter.limit });
  }

  inboxCounts(): InboxCounts {
    const row = this.db
      .query<{ unread: number | null; attention: number | null }, []>(
        `SELECT COUNT(*) AS unread, SUM(kind IN ${ATTENTION_KINDS}) AS attention FROM inbox WHERE read_at IS NULL`,
      )
      .get();
    return { unreadCount: row?.unread ?? 0, attentionCount: row?.attention ?? 0 };
  }

  /** Unread items of `kinds` tied to the session or the agent run, newest first. */
  unreadInboxFor(kinds: readonly InboxKind[], link: { sessionId: string | null; agentRunId: string | null }): InboxItem[] {
    if ((link.sessionId === null && link.agentRunId === null) || kinds.length === 0) return [];
    return this.inbox.where(
      `read_at IS NULL AND kind IN (${kinds.map(() => "?").join(", ")}) AND (session_id = ? OR agent_run_id = ?)`,
      ...kinds,
      link.sessionId,
      link.agentRunId,
    );
  }

  latestInboxForSession(sessionId: string): InboxItem | null {
    return this.inbox.where("session_id = ?", sessionId)[0] ?? null;
  }

  markInboxRead(readAt: string, target: { ids: readonly string[] } | { all: true }): number {
    if ("all" in target) return this.db.query("UPDATE inbox SET read_at = ? WHERE read_at IS NULL").run(readAt).changes;
    if (target.ids.length === 0) return 0;
    return this.db
      .query<Row, Binding[]>(`UPDATE inbox SET read_at = ? WHERE read_at IS NULL AND id IN (${target.ids.map(() => "?").join(", ")})`)
      .run(readAt, ...target.ids).changes;
  }

  pruneInbox(keep: number): number {
    return this.db
      .query("DELETE FROM inbox WHERE id NOT IN (SELECT id FROM inbox ORDER BY updated_at DESC, rowid DESC LIMIT ?)")
      .run(keep).changes;
  }

  /** Inserts or refreshes a device; a re-registered token keeps its `created_at`. */
  savePushDevice(device: PushDevice): PushDevice {
    const row = this.db
      .query<Row, Binding[]>(
        `INSERT INTO push_devices (token, platform, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(token) DO UPDATE SET platform = excluded.platform, name = excluded.name, updated_at = excluded.updated_at
          RETURNING *`,
      )
      .get(device.token, device.platform, device.name, device.createdAt, device.updatedAt);
    return row ? pushDeviceFromRow(row) : device;
  }

  setting(key: string): string | null {
    const row = this.db.query<Row, [string]>("SELECT value FROM settings WHERE key = ?").get(key);
    return row ? text(row, "value") : null;
  }

  saveSetting(key: string, value: string, at: string): void {
    this.db
      .query("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .run(key, value, at);
  }

  markConfidential(projectId: string, at: string): void {
    this.db.query("INSERT INTO confidential_projects (project_id, marked_at) VALUES (?, ?) ON CONFLICT(project_id) DO NOTHING").run(projectId, at);
  }

  isConfidential(projectId: string): boolean {
    return this.db.query<Row, [string]>("SELECT 1 FROM confidential_projects WHERE project_id = ?").get(projectId) !== null;
  }

  confidentialProjectIds(): string[] {
    return this.db.query<Row, []>("SELECT project_id FROM confidential_projects ORDER BY project_id").all().map((row) => text(row, "project_id"));
  }

  projectClaudeAccount(projectId: string): string | null {
    const row = this.db.query<Row, [string]>("SELECT account_id FROM project_claude_accounts WHERE project_id = ?").get(projectId);
    return row ? text(row, "account_id") : null;
  }

  setProjectClaudeAccount(projectId: string, accountId: string | null, at: string): void {
    if (accountId === null) {
      this.db.query("DELETE FROM project_claude_accounts WHERE project_id = ?").run(projectId);
      return;
    }
    this.db
      .query(
        "INSERT INTO project_claude_accounts (project_id, account_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at",
      )
      .run(projectId, accountId, at);
  }

  /** Account of the newest agent run with this Claude session id. */
  sessionClaudeAccount(sessionId: string): string | null {
    const row = this.db
      .query<Row, [string]>("SELECT claude_account_id FROM agent_runs WHERE session_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1")
      .get(sessionId);
    return row ? textOrNull(row, "claude_account_id") : null;
  }

  pushDevices(): PushDevice[] {
    return this.db.query<Row, []>("SELECT * FROM push_devices ORDER BY updated_at DESC, rowid DESC").all().map(pushDeviceFromRow);
  }

  deletePushDevices(tokens: readonly string[]): PushDevice[] {
    if (tokens.length === 0) return [];
    return this.db
      .query<Row, Binding[]>(`DELETE FROM push_devices WHERE token IN (${placeholders(tokens)}) RETURNING *`)
      .all(...tokens)
      .map(pushDeviceFromRow);
  }

  saveLiveActivityToken(record: LiveActivityToken): LiveActivityToken {
    const row = this.db
      .query<Row, Binding[]>(
        `INSERT INTO live_activity_tokens (token, kind, activity_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(token) DO UPDATE SET kind = excluded.kind, activity_id = excluded.activity_id, updated_at = excluded.updated_at
          RETURNING *`,
      )
      .get(record.token, record.kind, record.activityId, record.createdAt, record.updatedAt);
    return row ? liveActivityTokenFromRow(row) : record;
  }

  liveActivityTokens(): LiveActivityToken[] {
    return this.db.query<Row, []>("SELECT * FROM live_activity_tokens ORDER BY updated_at DESC, rowid DESC").all().map(liveActivityTokenFromRow);
  }

  deleteLiveActivityTokens(tokens: readonly string[]): LiveActivityToken[] {
    if (tokens.length === 0) return [];
    return this.db
      .query<Row, Binding[]>(`DELETE FROM live_activity_tokens WHERE token IN (${placeholders(tokens)}) RETURNING *`)
      .all(...tokens)
      .map(liveActivityTokenFromRow);
  }

  artifactsForBuild(buildId: string): Artifact[] {
    return this.artifacts.where("build_id = ?", buildId).reverse();
  }

  /** Deletes the artifact row and clears `artifact_id` on the inbox items that announced it. */
  deleteArtifact(id: string): Artifact | null {
    return this.db.transaction(() => {
      this.db.query("UPDATE inbox SET artifact_id = NULL WHERE artifact_id = ?").run(id);
      return this.artifacts.delete("id = ?", id)[0] ?? null;
    })();
  }

  appendAgentEvent(runId: string, event: AgentRunEvent): void {
    this.db
      .query("INSERT OR REPLACE INTO agent_run_events (run_id, seq, event) VALUES (?, ?, ?)")
      .run(runId, event.seq, JSON.stringify(event));
  }

  agentEvents(runId: string): AgentRunEvent[] {
    return this.db
      .query<{ event: string }, [string]>("SELECT event FROM agent_run_events WHERE run_id = ? ORDER BY seq")
      .all(runId)
      .map((row) => JSON.parse(row.event) as AgentRunEvent);
  }

  agentRunList(filter: { projectId?: string; archived: boolean }): AgentRun[] {
    return this.agentRuns.list({ ...filter, where: filter.archived ? "archived_at IS NOT NULL" : "archived_at IS NULL" });
  }

  /** Sets or clears `archived_at` on finished runs matching `target` (except `skip`); returns the changed runs. */
  setAgentRunsArchived(target: AgentRunTarget, archivedAt: string | null, skip: readonly string[]): AgentRun[] {
    const { sql, params } = agentRunClause(target, skip);
    const unchanged = archivedAt === null ? "archived_at IS NOT NULL" : "archived_at IS NULL";
    return this.agentRuns.update("archived_at = ?", `${sql} AND ${unchanged}`, archivedAt, ...params);
  }

  /** Deletes finished runs matching `target` (except `skip`) with their events, unlinking inbox items and artifacts; returns the ids. */
  deleteAgentRuns(target: AgentRunTarget, skip: readonly string[]): string[] {
    const { sql, params } = agentRunClause(target, skip);
    const matching = `SELECT id FROM agent_runs WHERE ${sql}`;
    return this.db.transaction(() => {
      this.db.query<Row, Binding[]>(`DELETE FROM agent_run_events WHERE run_id IN (${matching})`).run(...params);
      this.db.query<Row, Binding[]>(`UPDATE inbox SET agent_run_id = NULL WHERE agent_run_id IN (${matching})`).run(...params);
      this.db.query<Row, Binding[]>(`UPDATE artifacts SET agent_run_id = NULL WHERE agent_run_id IN (${matching})`).run(...params);
      return this.db
        .query<{ id: string }, Binding[]>(`DELETE FROM agent_runs WHERE ${sql} RETURNING id`)
        .all(...params)
        .map((row) => row.id);
    })();
  }

  /** Blueprint §6: nothing is re-run after a restart; live rows become orphaned/failed/exited. */
  recoverAfterRestart(endedAt: string): { processes: number; terminals: number; builds: number; agentRuns: number } {
    const reason = "The controller restarted before this finished";
    return this.db.transaction(() => ({
      processes: this.db
        .query("UPDATE processes SET state = 'orphaned', ended_at = ? WHERE state IN ('starting', 'running')")
        .run(endedAt).changes,
      terminals: this.db.query("UPDATE terminals SET state = 'exited' WHERE state = 'running'").run().changes,
      builds: this.db
        .query(
          "UPDATE builds SET state = 'failed', ended_at = ?, error = COALESCE(error, ?) WHERE state IN ('queued', 'running')",
        )
        .run(endedAt, reason).changes,
      agentRuns: this.db
        .query("UPDATE agent_runs SET state = 'failed', ended_at = ?, error = COALESCE(error, ?) WHERE state = 'running'")
        .run(endedAt, reason).changes,
    }))();
  }
}
