import { randomBytes } from "node:crypto";
import { link, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { uptime } from "node:os";
import { join } from "node:path";
import {
  BOOT_SLACK_MS,
  DIR_MODE,
  LOCK_MAX_AGE_MS,
  LOCK_POLL_MAX_MS,
  LOCK_POLL_MIN_MS,
  LOCK_SUFFIX,
  STALE_LOCK_SUFFIX,
  STATE_FILE_MODE,
  TMP_PREFIX,
} from "./constants";
import { errnoCode } from "./errors";

export interface LockOwner {
  pid: number;
  startedAt: string;
  token: string;
}

const TOKEN_BYTES = 8;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseOwner(text: string): LockOwner | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) return null;
    const { pid, startedAt, token } = value as Partial<LockOwner>;
    return typeof pid === "number" && typeof token === "string" ? { pid, startedAt: String(startedAt ?? ""), token } : null;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errnoCode(error) === "EPERM";
  }
}

async function readOwner(path: string): Promise<LockOwner | null | undefined> {
  try {
    return parseOwner(await readFile(path, "utf8"));
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

export function isStale(owner: LockOwner, now = Date.now(), bootedAt = now - uptime() * 1000): boolean {
  if (!isAlive(owner.pid)) return true;
  const started = Date.parse(owner.startedAt);
  if (Number.isNaN(started)) return false;
  return started < bootedAt - BOOT_SLACK_MS || now - started > LOCK_MAX_AGE_MS;
}

async function breakIfStale(path: string): Promise<void> {
  const owner = await readOwner(path);
  if (owner === undefined) return;
  if (owner !== null && !isStale(owner)) return;
  const moved = `${path}.${randomBytes(TOKEN_BYTES).toString("hex")}${STALE_LOCK_SUFFIX}`;
  try {
    await rename(path, moved);
  } catch {
    return;
  }
  const taken = await readOwner(moved).catch(() => null);
  const same = owner === null ? taken === null : taken?.token === owner.token;
  if (!same && taken !== undefined) await link(moved, path).catch(() => undefined);
  await unlink(moved).catch(() => undefined);
}

export async function withFileLock<T>(directory: string, name: string, work: () => Promise<T>): Promise<T> {
  await mkdir(directory, { recursive: true, mode: DIR_MODE });
  const path = join(directory, `${name}${LOCK_SUFFIX}`);
  const owner: LockOwner = { pid: process.pid, startedAt: new Date().toISOString(), token: randomBytes(TOKEN_BYTES).toString("hex") };
  const staged = join(directory, `${TMP_PREFIX}${owner.token}`);
  await writeFile(staged, JSON.stringify(owner), { mode: STATE_FILE_MODE });
  try {
    for (let wait = LOCK_POLL_MIN_MS; ; wait = Math.min(wait * 2, LOCK_POLL_MAX_MS)) {
      try {
        await link(staged, path);
        break;
      } catch (error) {
        if (errnoCode(error) !== "EEXIST") throw error;
      }
      await breakIfStale(path);
      await delay(wait);
    }
  } finally {
    await unlink(staged).catch(() => undefined);
  }
  try {
    return await work();
  } finally {
    const current = await readOwner(path).catch(() => null);
    if (current?.token === owner.token) await unlink(path).catch(() => undefined);
  }
}
