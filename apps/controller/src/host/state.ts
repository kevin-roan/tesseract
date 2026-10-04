import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { generateToken } from "../auth/token";

export type HostState = {
  token: string | null;
  pinHash: string | null;
  pinSetAt: string | null;
  failures: number;
  lockedUntil: string | null;
  lockouts: number;
};

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

const EMPTY: HostState = { token: null, pinHash: null, pinSetAt: null, failures: 0, lockedUntil: null, lockouts: 0 };

const text = (value: unknown) => (typeof value === "string" && value ? value : null);
const count = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0);

/** state.json (0600) in a 0700 directory; every change rewrites it atomically. */
export class HostStateStore {
  constructor(
    readonly dir: string,
    readonly file: string,
  ) {}

  read(): HostState {
    let raw: string;
    try {
      raw = readFileSync(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY };
      throw error;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      token: text(parsed.token),
      pinHash: text(parsed.pinHash),
      pinSetAt: text(parsed.pinSetAt),
      failures: count(parsed.failures),
      lockedUntil: text(parsed.lockedUntil),
      lockouts: count(parsed.lockouts),
    };
  }

  write(state: HostState): void {
    mkdirSync(this.dir, { recursive: true, mode: DIR_MODE });
    chmodSync(this.dir, DIR_MODE);
    const temp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: FILE_MODE });
    chmodSync(temp, FILE_MODE);
    renameSync(temp, this.file);
  }

  update(change: (state: HostState) => HostState): HostState {
    const next = change(this.read());
    this.write(next);
    return next;
  }

  ensureToken(): string {
    const state = this.read();
    if (state.token) return state.token;
    return this.update((current) => ({ ...current, token: generateToken() })).token ?? "";
  }

  rotateToken(): string {
    return this.update((current) => ({ ...current, token: generateToken() })).token ?? "";
  }

  async setPin(pin: string, now: Date = new Date()): Promise<void> {
    const pinHash = await Bun.password.hash(pin, { algorithm: "argon2id" });
    this.update((current) => ({
      ...current,
      token: current.token ?? generateToken(),
      pinHash,
      pinSetAt: now.toISOString(),
      failures: 0,
      lockedUntil: null,
      lockouts: 0,
    }));
  }
}
