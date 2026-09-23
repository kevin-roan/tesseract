import type { Database, SQLQueryBindings } from "bun:sqlite";
import type {
  AgentRun,
  AgentRunEvent,
  AgentRunState,
  Artifact,
  BuildJob,
  BuildProfile,
  BuildState,
  BuildTarget,
  ProcessCommand,
  ProcessInfo,
  ProcessState,
  TerminalInfo,
  TerminalKind,
  TerminalState,
} from "@theone/protocol";

type Row = Record<string, unknown>;
type Binding = string | number | null;
type Columns<T> = Record<string, (entity: T) => Binding>;

const DEFAULT_LIST_LIMIT = 200;

const text = (row: Row, key: string): string => String(row[key] ?? "");
const textOrNull = (row: Row, key: string): string | null => (row[key] == null ? null : String(row[key]));
const numOrNull = (row: Row, key: string): number | null => (row[key] == null ? null : Number(row[key]));
const num = (row: Row, key: string): number => Number(row[key] ?? 0);

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

  list(filter: { projectId?: string; limit?: number } = {}): T[] {
    const limit = filter.limit ?? DEFAULT_LIST_LIMIT;
    const rows =
      filter.projectId === undefined
        ? this.db.query<Row, [number]>(`SELECT * FROM ${this.table} ORDER BY ${this.orderBy} DESC, rowid DESC LIMIT ?`).all(limit)
        : this.db
            .query<Row, [string, number]>(
              `SELECT * FROM ${this.table} WHERE project_id = ? ORDER BY ${this.orderBy} DESC, rowid DESC LIMIT ?`,
            )
            .all(filter.projectId, limit);
    return rows.map(this.fromRow);
  }

  where(sql: string, ...params: Binding[]): T[] {
    return this.db
      .query<Row, Binding[]>(`SELECT * FROM ${this.table} WHERE ${sql} ORDER BY ${this.orderBy} DESC, rowid DESC`)
      .all(...params)
      .map(this.fromRow);
  }
}

export type BuildRecord = Omit<BuildJob, "artifacts">;

export class Repositories {
  readonly processes: Table<ProcessInfo>;
  readonly terminals: Table<TerminalInfo>;
  readonly builds: Table<BuildRecord>;
  readonly artifacts: Table<Artifact>;
  readonly agentRuns: Table<AgentRun>;

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
        session_id: (r) => r.sessionId,
        state: (r) => r.state,
        started_at: (r) => r.startedAt,
        ended_at: (r) => r.endedAt,
        cost_usd: (r) => r.costUsd,
        result: (r) => r.result,
        error: (r) => r.error,
      },
      (row) => ({
        id: text(row, "id"),
        projectId: textOrNull(row, "project_id"),
        prompt: text(row, "prompt"),
        sessionId: textOrNull(row, "session_id"),
        state: text(row, "state") as AgentRunState,
        startedAt: text(row, "started_at"),
        endedAt: textOrNull(row, "ended_at"),
        costUsd: numOrNull(row, "cost_usd"),
        result: textOrNull(row, "result"),
        error: textOrNull(row, "error"),
      }),
      "started_at",
    );
  }

  artifactsForBuild(buildId: string): Artifact[] {
    return this.artifacts.where("build_id = ?", buildId).reverse();
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
