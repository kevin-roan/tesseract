import type { HostLockStatus } from "@tesseract/protocol";

import type { HostSessionState, LockLine } from "../types";

export function sessionRemainingMs(session: HostSessionState | null, now: number = Date.now()): number {
  if (!session) return 0;
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isFinite(expiresAt) ? Math.max(0, expiresAt - now) : 0;
}

export function isSessionLive(session: HostSessionState | null, now: number = Date.now()): session is HostSessionState {
  return sessionRemainingMs(session, now) > 0;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function lockedOutFor(status: HostLockStatus | undefined, now: number = Date.now()): number {
  if (!status?.lockedUntil) return 0;
  const until = Date.parse(status.lockedUntil);
  return Number.isFinite(until) ? Math.max(0, until - now) : 0;
}

export function lockLine(status: HostLockStatus | undefined, now: number = Date.now()): LockLine | null {
  if (!status) return null;
  if (!status.pinSet) return { tone: "warning", message: "No PIN set. Run `bun run host pin` on the host." };
  const locked = lockedOutFor(status, now);
  if (locked > 0) return { tone: "danger", message: `Too many wrong PINs. Try again in ${formatCountdown(locked)}.` };
  if (status.attemptsLeft <= 2) {
    return { tone: "warning", message: `${status.attemptsLeft} ${status.attemptsLeft === 1 ? "attempt" : "attempts"} left before the host locks.` };
  }
  return null;
}
