import { Database } from "bun:sqlite";

const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE processes (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    cwd TEXT NOT NULL,
    pid INTEGER,
    port INTEGER,
    display INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL,
    exit_code INTEGER,
    started_at TEXT NOT NULL,
    ended_at TEXT
  );
  CREATE INDEX processes_by_project ON processes (project_id, started_at);

  CREATE TABLE terminals (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    project_id TEXT,
    title TEXT NOT NULL,
    cwd TEXT NOT NULL,
    pid INTEGER,
    cols INTEGER NOT NULL,
    rows INTEGER NOT NULL,
    state TEXT NOT NULL,
    exit_code INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE builds (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    target TEXT NOT NULL,
    profile TEXT NOT NULL,
    state TEXT NOT NULL,
    stage TEXT,
    progress REAL,
    started_at TEXT,
    ended_at TEXT,
    created_at TEXT NOT NULL,
    error TEXT
  );
  CREATE INDEX builds_by_project ON builds (project_id, created_at);

  CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    build_id TEXT,
    file_name TEXT NOT NULL,
    path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    platform TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX artifacts_by_project ON artifacts (project_id, created_at);
  CREATE INDEX artifacts_by_build ON artifacts (build_id);

  CREATE TABLE agent_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    prompt TEXT NOT NULL,
    session_id TEXT,
    state TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    cost_usd REAL,
    result TEXT,
    error TEXT
  );
  CREATE INDEX agent_runs_by_project ON agent_runs (project_id, started_at);

  CREATE TABLE agent_run_events (
    run_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    event TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
  );
  `,
  `
  CREATE TABLE inbox (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    project_id TEXT,
    session_id TEXT,
    agent_run_id TEXT,
    terminal_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    read_at TEXT
  );
  CREATE INDEX inbox_by_updated ON inbox (updated_at);
  CREATE INDEX inbox_unread ON inbox (read_at, kind);
  CREATE INDEX inbox_by_session ON inbox (session_id);
  CREATE INDEX inbox_by_agent_run ON inbox (agent_run_id);
  `,
  `
  ALTER TABLE agent_runs ADD COLUMN archived_at TEXT;
  `,
  `
  CREATE TABLE uploads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    kind TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX uploads_by_created ON uploads (created_at);

  ALTER TABLE agent_runs ADD COLUMN mode TEXT;
  ALTER TABLE agent_runs ADD COLUMN attachments TEXT;
  `,
  `
  ALTER TABLE artifacts ADD COLUMN source TEXT NOT NULL DEFAULT 'build';
  ALTER TABLE artifacts ADD COLUMN agent_run_id TEXT;
  ALTER TABLE artifacts ADD COLUMN note TEXT;
  ALTER TABLE inbox ADD COLUMN artifact_id TEXT;
  CREATE INDEX inbox_by_artifact ON inbox (artifact_id);
  `,
  `
  CREATE TABLE push_devices (
    token TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
  `
  ALTER TABLE agent_runs ADD COLUMN input_tokens INTEGER;
  ALTER TABLE agent_runs ADD COLUMN output_tokens INTEGER;
  ALTER TABLE agent_runs ADD COLUMN cache_read_tokens INTEGER;
  ALTER TABLE agent_runs ADD COLUMN cache_write_tokens INTEGER;
  ALTER TABLE agent_runs DROP COLUMN cost_usd;
  `,
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE sync_requests (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    paths TEXT,
    force INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    claimed_by TEXT,
    result TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX sync_requests_by_project ON sync_requests (project_id, created_at);
  CREATE INDEX sync_requests_by_status ON sync_requests (status, created_at);
  `,
  `
  CREATE TABLE live_activity_tokens (
    token TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    activity_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,  `
  CREATE TABLE confidential_projects (
    project_id TEXT PRIMARY KEY,
    marked_at TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE project_claude_accounts (
    project_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ALTER TABLE agent_runs ADD COLUMN claude_account_id TEXT;
  `,
  `
  CREATE TABLE project_names (
    project_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS push_devices (
    token TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ALTER TABLE push_devices ADD COLUMN device_id TEXT;
  CREATE INDEX push_devices_device_id ON push_devices (device_id);
  `,
  `
  ALTER TABLE agent_runs ADD COLUMN resumed_session_id TEXT;
  `,
  `
  UPDATE uploads SET path = replace(path, '/.theone/uploads/', '/.tesseract/uploads/');
  UPDATE agent_runs SET attachments = replace(attachments, '/.theone/uploads/', '/.tesseract/uploads/') WHERE attachments IS NOT NULL;
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function openDatabase(path: string): Database {
  const db = new Database(path, { create: true, strict: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA busy_timeout = 5000");
  migrate(db);
  return db;
}

function migrate(db: Database): void {
  const row = db.query<{ user_version: number }, []>("PRAGMA user_version").get();
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const sql = MIGRATIONS[version];
    if (sql === undefined) continue;
    db.transaction(() => {
      db.run(sql);
      db.run(`PRAGMA user_version = ${version + 1}`);
    })();
  }
}
