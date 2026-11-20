import { Database } from "bun:sqlite";
import type { Account, AccountDeviceKind, AccountProvider } from "@tesseract/protocol";

export type AccountRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  provider: AccountProvider;
  password_hash: string | null;
  apple_sub: string | null;
  headscale_user_id: string | null;
  created_at: string;
};

export type NewAccount = {
  email: string | null;
  displayName: string | null;
  provider: AccountProvider;
  passwordHash: string | null;
  appleSub: string | null;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  provider TEXT NOT NULL,
  password_hash TEXT,
  apple_sub TEXT UNIQUE,
  headscale_user_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
CREATE TABLE IF NOT EXISTS device_keys (
  preauth_key_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  hostname TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS device_keys_account ON device_keys(account_id);
`;

export function newAccountId(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString("hex");
}

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    provider: row.provider,
    createdAt: row.created_at,
  };
}

export class Store {
  readonly db: Database;

  constructor(path: string) {
    this.db = new Database(path, { create: true, strict: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
    this.db.run("PRAGMA busy_timeout = 5000");
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  createAccount(input: NewAccount): AccountRow {
    const row: AccountRow = {
      id: newAccountId(),
      email: input.email,
      display_name: input.displayName,
      provider: input.provider,
      password_hash: input.passwordHash,
      apple_sub: input.appleSub,
      headscale_user_id: null,
      created_at: new Date().toISOString(),
    };
    this.db
      .query(
        `INSERT INTO accounts (id, email, display_name, provider, password_hash, apple_sub, headscale_user_id, created_at)
         VALUES ($id, $email, $display_name, $provider, $password_hash, $apple_sub, $headscale_user_id, $created_at)`,
      )
      .run(row);
    return row;
  }

  accountById(id: string): AccountRow | null {
    return this.db.query<AccountRow, [string]>("SELECT * FROM accounts WHERE id = ?").get(id);
  }

  accountByEmail(email: string): AccountRow | null {
    return this.db.query<AccountRow, [string]>("SELECT * FROM accounts WHERE email = ?").get(email);
  }

  accountByAppleSub(sub: string): AccountRow | null {
    return this.db.query<AccountRow, [string]>("SELECT * FROM accounts WHERE apple_sub = ?").get(sub);
  }

  setPasswordHash(id: string, hash: string): void {
    this.db.query("UPDATE accounts SET password_hash = ? WHERE id = ?").run(hash, id);
  }

  setHeadscaleUserId(id: string, userId: string): void {
    this.db.query("UPDATE accounts SET headscale_user_id = ? WHERE id = ?").run(userId, id);
  }

  deleteAccount(id: string): void {
    this.db.query("DELETE FROM accounts WHERE id = ?").run(id);
  }

  createSession(tokenHash: string, accountId: string, expiresAt: number): void {
    this.db
      .query("INSERT INTO sessions (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .run(tokenHash, accountId, expiresAt, Date.now());
  }

  sessionAccount(tokenHash: string, now: number): AccountRow | null {
    return this.db
      .query<AccountRow, [string, number]>(
        `SELECT accounts.* FROM sessions JOIN accounts ON accounts.id = sessions.account_id
         WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
      )
      .get(tokenHash, now);
  }

  deleteSession(tokenHash: string): void {
    this.db.query("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }

  pruneSessions(now: number): void {
    this.db.query("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  }

  recordDeviceKey(preauthKeyId: string, accountId: string, kind: AccountDeviceKind, hostname: string): void {
    this.db
      .query(
        "INSERT OR REPLACE INTO device_keys (preauth_key_id, account_id, kind, hostname, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(preauthKeyId, accountId, kind, hostname, Date.now());
  }

  deviceKinds(accountId: string): Map<string, AccountDeviceKind> {
    const rows = this.db
      .query<{ preauth_key_id: string; kind: AccountDeviceKind }, [string]>(
        "SELECT preauth_key_id, kind FROM device_keys WHERE account_id = ?",
      )
      .all(accountId);
    return new Map(rows.map((row) => [row.preauth_key_id, row.kind]));
  }
}
