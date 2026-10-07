import { lstat, readdir } from "node:fs/promises";
import { join, posix } from "node:path";
import { createLogger } from "../log";
import { runCommand } from "../process";
import { GIT_DIR, GIT_EXECUTABLE_MODE, GIT_LIST_TIMEOUT_MS, LOCK_SUFFIX } from "./constants";
import { SyncBackError } from "./errors";
import { IS_WINDOWS, isExecutable, lexists } from "./fsutil";
import { buildManifest, checkRelative, hashPath, isWithin, resolvePath, toPosix, type Hasher, type Manifest } from "./manifest";

export type GitManifest = Record<string, string>;

export interface HostTree {
  manifest: Manifest;
  executable: string[];
  git: GitManifest | null;
}

const log = createLogger("syncback");
const REPLACEMENT_CHARACTER = "\uFFFD";
const GIT_LIST_ARGS = ["ls-files", "-z", "--cached", "--others", "--exclude-standard"] as const;
const GIT_STAGE_ARGS = ["ls-files", "-s", "-z"] as const;

export function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sorted(values: Iterable<string>): string[] {
  return [...values].sort(byCodePoint);
}

async function gitList(root: string): Promise<string | null> {
  const result = await runCommand("git", ["-C", root, ...GIT_LIST_ARGS], { timeoutMs: GIT_LIST_TIMEOUT_MS });
  return result.code === 0 ? result.stdout : null;
}

async function* walk(root: string, base = ""): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(join(root, base), { withFileTypes: true });
  } catch {
    return;
  }
  const directories: string[] = [];
  for (const entry of entries) {
    const rel = base ? posix.join(base, entry.name) : entry.name;
    if (entry.isDirectory()) directories.push(rel);
    else yield rel;
  }
  for (const directory of directories) yield* walk(root, directory);
}

export async function collectFiles(root: string): Promise<string[]> {
  const listed = await gitList(root);
  if (listed === null) {
    const found: string[] = [];
    for await (const rel of walk(root)) found.push(toPosix(rel));
    return found;
  }
  const files: string[] = [];
  if (await lexists(join(root, GIT_DIR))) files.push(GIT_DIR);
  for (const path of new Set(listed.split("\0").filter(Boolean))) {
    if (path.includes(REPLACEMENT_CHARACTER)) {
      log.warn(`skipping a file name that is not UTF-8: ${path}`);
      continue;
    }
    if (await lexists(join(root, path))) files.push(path);
  }
  return files;
}

export async function contained(root: string, files: Iterable<string>): Promise<string[]> {
  const resolvedRoot = await resolvePath(root);
  const parents = new Map<string, boolean>();
  const kept: string[] = [];
  for (const file of files) {
    const rel = toPosix(file);
    try {
      checkRelative(rel);
    } catch (error) {
      if (error instanceof SyncBackError) continue;
      throw error;
    }
    const parent = posix.dirname(rel);
    if (!parents.has(parent)) {
      const resolved = await resolvePath(parent === "." ? resolvedRoot : join(resolvedRoot, parent));
      parents.set(parent, isWithin(resolvedRoot, resolved));
    }
    if (parents.get(parent)) kept.push(rel);
  }
  return kept;
}

export async function gitManifest(root: string): Promise<GitManifest | null> {
  const top = join(root, GIT_DIR);
  try {
    if (!(await lstat(top)).isDirectory()) return null;
  } catch {
    return null;
  }
  const found: GitManifest = {};
  for await (const rel of walk(top)) {
    if (rel.endsWith(LOCK_SUFFIX)) continue;
    try {
      const info = await lstat(join(top, rel), { bigint: true });
      if (info.isFile()) found[toPosix(rel)] = `${info.size}:${info.mtimeNs}`;
    } catch {
      continue;
    }
  }
  return found;
}

export async function gitIndexModes(root: string): Promise<Map<string, boolean> | null> {
  const result = await runCommand("git", ["-C", root, ...GIT_STAGE_ARGS], { timeoutMs: GIT_LIST_TIMEOUT_MS });
  if (result.code !== 0) return null;
  const found = new Map<string, boolean>();
  for (const record of result.stdout.split("\0")) {
    const tab = record.indexOf("\t");
    if (tab !== -1) found.set(record.slice(tab + 1), record.startsWith(`${GIT_EXECUTABLE_MODE} `));
  }
  return found;
}

export async function portableExecutables(root: string, paths: Iterable<string>, previous: readonly string[] | null = null): Promise<Set<string>> {
  const indexed = (await gitIndexModes(root)) ?? new Map<string, boolean>();
  const known = new Set(previous ?? []);
  return new Set([...paths].filter((path) => indexed.get(path) ?? known.has(path)));
}

export async function executables(root: string, manifest: Manifest, previous: readonly string[] | null = null): Promise<string[]> {
  if (IS_WINDOWS) return sorted(await portableExecutables(root, Object.keys(manifest), previous));
  const found: string[] = [];
  for (const path of Object.keys(manifest)) if (await isExecutable(join(root, path))) found.push(path);
  return sorted(found);
}

export async function scanTree(
  root: string,
  files: Iterable<string>,
  hasher: Hasher = hashPath,
  previous: readonly string[] | null = null,
): Promise<HostTree> {
  const manifest = await buildManifest(root, await contained(root, files), hasher);
  return { manifest, executable: await executables(root, manifest, previous), git: await gitManifest(root) };
}
