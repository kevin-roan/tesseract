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
];

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
