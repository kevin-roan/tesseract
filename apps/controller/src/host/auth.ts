import { createHash, randomBytes } from "node:crypto";
import { LIMITS, type HostLockStatus, type HostSession } from "@tesseract/protocol";
import { tokensEqual } from "../auth/token";
import { forbidden, HttpError, unavailable } from "../core/errors";
import type { Logger } from "../core/logger";
import type { HostState, HostStateStore } from "./state";

type StoredSession = { expiresAt: number; token: string; pinSetAt: string };

export type HostAuthOptions = {
  now?: () => number;
  sessionTtlMs?: number;
};

const SESSION_BYTES = 32;
const BEARER = /^Bearer\s+(\S+)\s*$/i;

const sessionKey = (session: string) => createHash("sha256").update(session, "utf8").digest("hex");

export function bearer(header: string | null): string | null {
  return (header && BEARER.exec(header)?.[1]) || null;
}

export const unauthorized = (message: string) => new HttpError("unauthorized", message);

function lockoutMs(lockouts: number): number {
  return Math.min(LIMITS.hostLockoutBaseMs * 2 ** lockouts, LIMITS.hostLockoutMaxMs);
}

/** Host token + PIN → short-lived session. State is re-read per call so `host pin` and `host token --rotate` apply live. */
export class HostAuth {
  private readonly sessions = new Map<string, StoredSession>();
  private queue: Promise<unknown> = Promise.resolve();
  private readonly now: () => number;
  private readonly sessionTtlMs: number;

  constructor(
    private readonly store: HostStateStore,
    private readonly logger: Logger,
    options: HostAuthOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.sessionTtlMs = options.sessionTtlMs ?? LIMITS.hostSessionTtlMs;
  }

  /** Throws 401 unless `header` carries the host token. */
  requireToken(header: string | null): HostState {
    const state = this.store.read();
    const candidate = bearer(header);
    if (!candidate || !state.token || !tokensEqual(candidate, state.token)) throw unauthorized("Missing or invalid host token");
    return state;
  }

  /** Throws 401 unless `header` carries a live session issued for the current token and PIN. */
  requireSession(header: string | null): void {
    const candidate = bearer(header);
    const key = candidate ? sessionKey(candidate) : null;
    const session = key ? this.sessions.get(key) : undefined;
    if (!key || !session) throw unauthorized("Missing or expired host session; unlock with the PIN");
    const state = this.store.read();
    const valid = session.expiresAt > this.now() && state.token === session.token && state.pinHash !== null && state.pinSetAt === session.pinSetAt;
    if (!valid) {
      this.sessions.delete(key);
      throw unauthorized("Missing or expired host session; unlock with the PIN");
    }
  }

  status(state: HostState = this.store.read()): HostLockStatus {
    const locked = state.lockedUntil !== null && Date.parse(state.lockedUntil) > this.now();
    return {
      pinSet: state.pinHash !== null,
      attemptsLeft: locked ? 0 : Math.max(0, LIMITS.hostPinMaxAttempts - state.failures),
      lockedUntil: locked ? state.lockedUntil : null,
    };
  }

  /** Attempts run one at a time, so parallel requests cannot outpace the lockout. */
  unlock(header: string | null, pin: string, remote: string | null): Promise<HostSession> {
    const attempt = this.queue.then(() => this.tryUnlock(header, pin, remote));
    this.queue = attempt.catch(() => undefined);
    return attempt;
  }

  lock(header: string | null, session: string): void {
    this.requireToken(header);
    this.sessions.delete(sessionKey(session));
  }

  get sessionCount(): number {
    return this.sessions.size;
  }

  private async tryUnlock(header: string | null, pin: string, remote: string | null): Promise<HostSession> {
    const state = this.requireToken(header);
    if (!state.pinHash || !state.pinSetAt) throw unavailable("No PIN is set; run tesseract-controller host pin on the host");
    const now = this.now();
    if (state.lockedUntil !== null && Date.parse(state.lockedUntil) > now) {
      throw forbidden(`Too many wrong PINs; try again after ${state.lockedUntil}`);
    }
    if (await Bun.password.verify(pin, state.pinHash)) {
      this.store.update((current) => ({ ...current, failures: 0, lockedUntil: null, lockouts: 0 }));
      return this.issue(state.token ?? "", state.pinSetAt, now);
    }
    const failures = state.failures + 1;
    if (failures >= LIMITS.hostPinMaxAttempts) {
      const lockedUntil = new Date(now + lockoutMs(state.lockouts)).toISOString();
      this.store.update((current) => ({ ...current, failures: 0, lockedUntil, lockouts: current.lockouts + 1 }));
      this.logger.warn("host shell locked after wrong PINs", { remote, lockedUntil });
      throw forbidden(`Too many wrong PINs; try again after ${lockedUntil}`);
    }
    this.store.update((current) => ({ ...current, failures, lockedUntil: null }));
    const left = LIMITS.hostPinMaxAttempts - failures;
    this.logger.warn("wrong host shell PIN", { remote, attemptsLeft: left });
    throw forbidden(`Wrong PIN (${left} ${left === 1 ? "attempt" : "attempts"} left)`);
  }

  private issue(token: string, pinSetAt: string, now: number): HostSession {
    for (const [key, stored] of this.sessions) if (stored.expiresAt <= now) this.sessions.delete(key);
    const session = randomBytes(SESSION_BYTES).toString("base64url");
    const expiresAt = now + this.sessionTtlMs;
    this.sessions.set(sessionKey(session), { expiresAt, token, pinSetAt });
    return { session, expiresAt: new Date(expiresAt).toISOString() };
  }
}
