import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readlink,
  rename,
  rmdir,
  stat,
  symlink,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { dirname, join, relative, isAbsolute, sep } from "node:path";
import {
  ACCESS_BITS,
  COPY_CHUNK_BYTES,
  DEFAULT_FILE_MODE,
  EXEC_BITS,
  PERMISSION_BITS,
  READ_BITS,
  RENAME_RETRY_DELAYS_MS,
  STATE_FILE_MODE,
  TMP_PREFIX,
} from "./constants";
import { SyncBackError, errnoCode, isMissing } from "./errors";
import { SYNC_LABELS } from "./labels";

export const IS_WINDOWS = process.platform === "win32";
const RENAME_RETRY_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
const TEMP_RANDOM_BYTES = 6;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function tempBeside(target: string): string {
  return join(dirname(target), `${TMP_PREFIX}${randomBytes(TEMP_RANDOM_BYTES).toString("hex")}`);
}

export async function renameOver(source: string, target: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      const retry = IS_WINDOWS && RENAME_RETRY_CODES.has(errnoCode(error) ?? "") && attempt < RENAME_RETRY_DELAYS_MS.length;
      if (!retry) throw error;
      await delay(RENAME_RETRY_DELAYS_MS[attempt] as number);
    }
  }
}

export async function fsyncDir(directory: string): Promise<void> {
  if (IS_WINDOWS) return;
  try {
    const handle = await open(directory, constants.O_RDONLY);
    try {
      await handle.sync();
    } catch {
      return;
    } finally {
      await handle.close();
    }
  } catch {
    return;
  }
}

async function removeQuietly(path: string): Promise<void> {
  await unlink(path).catch(() => undefined);
}

async function copyBytes(source: string, target: FileHandle): Promise<void> {
  const input = await open(source, "r");
  try {
    const buffer = Buffer.allocUnsafe(COPY_CHUNK_BYTES);
    for (;;) {
      const { bytesRead } = await input.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) return;
      await target.write(buffer, 0, bytesRead);
    }
  } finally {
    await input.close();
  }
}

async function copyNew(source: string, target: string, mode: number, times?: { atime: Date; mtime: Date }): Promise<void> {
  const handle = await open(target, "wx", STATE_FILE_MODE);
  try {
    await copyBytes(source, handle);
    if (!IS_WINDOWS) await handle.chmod(mode);
    if (times) await handle.utimes(times.atime, times.mtime);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeAtomic(target: string, data: Uint8Array | string, mode = DEFAULT_FILE_MODE): Promise<void> {
  const temp = tempBeside(target);
  try {
    const handle = await open(temp, "wx", mode);
    try {
      await handle.writeFile(data);
      if (!IS_WINDOWS) await handle.chmod(mode);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await renameOver(temp, target);
  } catch (error) {
    await removeQuietly(temp);
    throw error;
  }
}

async function makeSymlink(linkText: string, path: string, rel: string): Promise<void> {
  try {
    await symlink(linkText, path);
  } catch (error) {
    if (IS_WINDOWS && errnoCode(error) === "EPERM") throw new SyncBackError(SYNC_LABELS.symlinkUnsupported(rel), { cause: error });
    throw error;
  }
}

export async function install(source: string, target: string, mode?: number): Promise<void> {
  const info = await lstat(source);
  const temp = tempBeside(target);
  try {
    if (info.isSymbolicLink()) {
      await makeSymlink(await readlink(source), temp, target);
    } else {
      await copyNew(source, temp, mode ?? info.mode & PERMISSION_BITS);
    }
    await renameOver(temp, target);
  } catch (error) {
    await removeQuietly(temp);
    throw error;
  }
}

export async function copyForSnapshot(source: string, target: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  const info = await lstat(source);
  if (info.isSymbolicLink()) {
    await makeSymlink(await readlink(source), target, target);
    return;
  }
  await removeQuietly(target);
  await copyNew(source, target, info.mode & PERMISSION_BITS, { atime: info.atime, mtime: info.mtime });
}

export async function lexists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function fileMode(path: string): Promise<number | null> {
  try {
    const info = await lstat(path);
    return info.isFile() ? info.mode & PERMISSION_BITS : null;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function isExecutable(path: string): Promise<boolean> {
  if (IS_WINDOWS) return false;
  try {
    const info = await lstat(path);
    return info.isFile() && (info.mode & EXEC_BITS) !== 0;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export function withExecutable(mode: number, executable: boolean): number {
  if (IS_WINDOWS) return mode;
  if (!executable) return mode & ~EXEC_BITS;
  return mode & EXEC_BITS ? mode : mode | ((mode & READ_BITS) >> 2);
}

export async function remove(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

export function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}

export async function makeParents(root: string, target: string, created: string[]): Promise<void> {
  const missing: string[] = [];
  let parent = dirname(target);
  while (parent !== root && !(await lexists(parent))) {
    missing.push(parent);
    const next = dirname(parent);
    if (next === parent) break;
    parent = next;
  }
  for (const directory of missing.reverse()) {
    await mkdir(directory);
    created.push(directory);
  }
}

export async function pruneEmptyParents(root: string, target: string): Promise<void> {
  let parent = dirname(target);
  while (parent !== root && isInside(root, parent)) {
    try {
      await rmdir(parent);
    } catch {
      return;
    }
    parent = dirname(parent);
  }
}

export function accessBits(mode: number): number {
  return mode & ACCESS_BITS;
}
