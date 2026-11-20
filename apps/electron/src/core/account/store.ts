import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AccountSchema, type Account } from "@tesseract/protocol";
import type { TokenCipher } from "../connection/token-vault";
import { ACCOUNT } from "./constants";

export interface StoredSession {
  token: string;
  expiresAt: string;
  account: Account;
}

export interface StoredAccount {
  serverUrl: string | null;
  session: StoredSession | null;
}

interface FileShape {
  serverUrl?: unknown;
  session?: { sealed?: unknown; expiresAt?: unknown; account?: unknown } | null;
}

/**
 * The account server URL and the session in `<userData>/account-session.json`. The token is sealed with the
 * cipher (Electron `safeStorage`); without one it is never written, so the session lasts until the app quits.
 */
export class AccountStore {
  private memory: StoredSession | null = null;

  constructor(
    private readonly file: string,
    private readonly cipher: TokenCipher | null,
  ) {}

  canPersist(): boolean {
    try {
      return this.cipher?.available() === true;
    } catch {
      return false;
    }
  }

  async read(): Promise<StoredAccount> {
    const data = await this.readFile();
    const serverUrl = typeof data.serverUrl === "string" && data.serverUrl ? data.serverUrl : null;
    return { serverUrl, session: this.memory ?? this.unseal(data.session) };
  }

  async write(next: StoredAccount): Promise<void> {
    this.memory = next.session && !this.canPersist() ? next.session : null;
    const session =
      next.session && this.canPersist() && this.cipher
        ? { sealed: this.cipher.seal(next.session.token), expiresAt: next.session.expiresAt, account: next.session.account }
        : null;
    await mkdir(dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify({ serverUrl: next.serverUrl, session }, null, 2)}\n`, { mode: ACCOUNT.fileMode });
    await rename(temp, this.file);
  }

  private async readFile(): Promise<FileShape> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, "utf8"));
      return typeof parsed === "object" && parsed !== null ? (parsed as FileShape) : {};
    } catch {
      return {};
    }
  }

  private unseal(raw: FileShape["session"]): StoredSession | null {
    if (!raw || typeof raw.sealed !== "string" || typeof raw.expiresAt !== "string" || !this.cipher || !this.canPersist()) return null;
    const account = AccountSchema.safeParse(raw.account);
    if (!account.success) return null;
    try {
      const token = this.cipher.unseal(raw.sealed).trim();
      return token ? { token, expiresAt: raw.expiresAt, account: account.data } : null;
    } catch {
      return null;
    }
  }
}
