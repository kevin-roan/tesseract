import { createHash } from "node:crypto";
import { lstat, open, readlink, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, posix, sep } from "node:path";
import { GIT_DIR, HASH_CHUNK_BYTES, SKIPPED_DIRS } from "./constants";
import { SyncBackError, isMissing } from "./errors";
import { IS_WINDOWS, isInside } from "./fsutil";
import { SYNC_LABELS } from "./labels";

export type Manifest = Record<string, string>;
export type Hasher = (path: string) => Promise<string | null>;

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;
const WINDOWS_INVALID = /[<>:"|?*\u0000-\u001f]/;

export function hashBytes(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function hashPath(path: string): Promise<string | null> {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  if (info.isSymbolicLink()) return hashBytes(await readlink(path, { encoding: "buffer" }));
  if (!info.isFile()) return null;
  const digest = createHash("sha256");
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(HASH_CHUNK_BYTES);
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, HASH_CHUNK_BYTES, null);
      if (bytesRead === 0) break;
      digest.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return digest.digest("hex");
}

export class DigestCache {
  private readonly digests = new Map<string, { key: string; digest: string | null }>();

  constructor(private readonly hasher: Hasher = hashPath) {}

  readonly hash: Hasher = async (path) => {
    let info;
    try {
      info = await lstat(path, { bigint: true });
    } catch (error) {
      if (!isMissing(error)) throw error;
      this.digests.delete(path);
      return null;
    }
    const key = `${info.mode}:${info.size}:${info.mtimeNs}:${info.ctimeNs}:${info.ino}`;
    const cached = this.digests.get(path);
    if (cached && cached.key === key) return cached.digest;
    const digest = await this.hasher(path);
    this.digests.set(path, { key, digest });
    return digest;
  };
}

export function toPosix(rel: string): string {
  return IS_WINDOWS ? rel.split("\\").join("/") : rel;
}

export function isGitPath(rel: string): boolean {
  return rel.split("/").includes(GIT_DIR);
}

export async function buildManifest(root: string, files: Iterable<string>, hasher: Hasher = hashPath): Promise<Manifest> {
  const manifest: Manifest = {};
  for (const file of files) {
    const rel = toPosix(file);
    if (isGitPath(rel) || SKIPPED_DIRS.includes(rel.split("/")[0] as string)) continue;
    const digest = await hasher(join(root, rel));
    if (digest !== null) manifest[rel] = digest;
  }
  return manifest;
}

function checkWindowsName(rel: string): void {
  for (const part of rel.split("/")) {
    if (WINDOWS_INVALID.test(part) || WINDOWS_RESERVED.test(part) || /[. ]$/.test(part)) {
      throw new SyncBackError(SYNC_LABELS.windowsName(rel));
    }
  }
}

export function checkRelative(rel: unknown): string {
  if (typeof rel !== "string" || !rel || rel.includes("\0") || rel.includes("\\")) {
    throw new SyncBackError(SYNC_LABELS.unsafePath(rel));
  }
  if (rel.startsWith("/") || posix.isAbsolute(rel)) throw new SyncBackError(SYNC_LABELS.absolutePath(rel));
  const parts = rel.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) throw new SyncBackError(SYNC_LABELS.plainPath(rel));
  if (parts.includes(GIT_DIR)) throw new SyncBackError(SYNC_LABELS.insideGit(rel));
  if (IS_WINDOWS) checkWindowsName(rel);
  return rel;
}

export async function resolvePath(path: string): Promise<string> {
  const pending: string[] = [];
  let current = path;
  for (;;) {
    try {
      const resolved = await realpath(current);
      return pending.length ? join(resolved, ...pending.reverse()) : resolved;
    } catch (error) {
      const parent = dirname(current);
      if (parent === current) throw error;
      pending.push(basename(current));
      current = parent;
    }
  }
}

export function isWithin(root: string, path: string): boolean {
  return path === root || isInside(root, path);
}

export async function resolveInside(root: string, rel: string): Promise<string> {
  checkRelative(rel);
  const resolvedRoot = await resolvePath(root);
  const target = join(resolvedRoot, rel);
  const parent = await resolvePath(dirname(target));
  if (!isWithin(resolvedRoot, parent)) throw new SyncBackError(SYNC_LABELS.leavesRoot(rel, resolvedRoot));
  return target;
}

export async function linkLeaves(root: string, link: string, text: string): Promise<boolean> {
  if (!text || isAbsolute(text) || posix.isAbsolute(text)) return true;
  const resolved = await resolvePath(`${dirname(link)}${sep}${text}`);
  return !isWithin(await resolvePath(root), resolved);
}

export function nestedUnder(rel: string, paths: Set<string>): string | null {
  for (let index = rel.indexOf("/"); index !== -1; index = rel.indexOf("/", index + 1)) {
    const parent = rel.slice(0, index);
    if (paths.has(parent)) return parent;
  }
  return null;
}
