import type { Dirent, Stats } from "node:fs";
import { lstat, readdir, rm, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import {
  STORAGE_CATEGORIES,
  type ProjectDirectory,
  type ProjectFile,
  type ProjectFileKind,
  type ProjectStorage,
  type StorageCategory,
} from "@tesseract/protocol";
import { mapLimit } from "../core/concurrency";
import { badRequest, notFound, unavailable } from "../core/errors";
import { run } from "../core/exec";
import type { Logger } from "../core/logger";
import { isInside, realpathOrNull } from "../core/paths";
import { nowIso } from "../core/time";
import type { ProjectService } from "./projects";

const MAX_DIRECTORY_ENTRIES = 2_000;
const STAT_CONCURRENCY = 32;
const SCAN_MAX_DEPTH = 8;
const SCAN_MAX_DIRS = 20_000;
const DU_TIMEOUT_MS = 120_000;
const GIT_TIMEOUT_MS = 15_000;
const DU_BATCH = 200;
const STORAGE_TTL_MS = 30_000;

/** Folder names that hold regenerable data; in a git repo a folder only counts when git ignores it. */
const CATEGORY_DIRS: Record<StorageCategory, ReadonlySet<string>> = {
  dependencies: new Set(["node_modules", "bower_components", ".venv", "venv", "Pods", ".pnpm-store", ".yarn-cache"]),
  builds: new Set(["build", "builds", "dist", "out", "release", "releases", ".output", "target", "DerivedData", ".cxx"]),
  caches: new Set([
    ".gradle",
    ".expo",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".angular",
    ".turbo",
    ".parcel-cache",
    ".cache",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".dart_tool",
    "coverage",
  ]),
};
/** Outside git nothing says these are generated, so only the unambiguous categories are offered. */
const UNTRACKED_SAFE: ReadonlySet<StorageCategory> = new Set(["dependencies", "caches"]);

type Candidate = { category: StorageCategory; path: string };

const toPosix = (path: string) => path.split(sep).join("/");

function categoryOf(name: string): StorageCategory | null {
  return STORAGE_CATEGORIES.find((category) => CATEGORY_DIRS[category].has(name)) ?? null;
}

function kindOf(entry: Dirent | Stats): ProjectFileKind {
  if (entry.isSymbolicLink()) return "symlink";
  if (entry.isDirectory()) return "dir";
  if (entry.isFile()) return "file";
  return "other";
}

/** Browses project folders for the apps and measures (and clears) the regenerable data they hold. */
export class ProjectFileService {
  private readonly storage = new Map<string, { at: number; value: Promise<ProjectStorage> }>();

  constructor(
    private readonly projects: ProjectService,
    private readonly logger: Logger,
  ) {}

  async list(projectId: string, path: string): Promise<ProjectDirectory> {
    const { id, root, real, rel } = this.locate(projectId, path);
    const info = await stat(real);
    if (!info.isDirectory()) throw badRequest(`${rel || "/"} is not a directory`);
    const dirents = await readdir(real, { withFileTypes: true });
    const truncated = dirents.length > MAX_DIRECTORY_ENTRIES;
    const entries = await mapLimit(dirents.slice(0, MAX_DIRECTORY_ENTRIES), STAT_CONCURRENCY, async (dirent): Promise<ProjectFile> => {
      const entryPath = rel ? `${rel}/${dirent.name}` : dirent.name;
      const full = join(real, dirent.name);
      const followed = dirent.isSymbolicLink() && isInside(root, realpathOrNull(full) ?? "");
      const info = await (followed ? stat(full) : lstat(full)).catch(() => null);
      const kind = info ? kindOf(info) : kindOf(dirent);
      return {
        name: dirent.name,
        path: entryPath,
        kind,
        sizeBytes: kind === "file" && info ? info.size : null,
        modifiedAt: info ? info.mtime.toISOString() : null,
      };
    });
    entries.sort((a, b) => Number(b.kind === "dir") - Number(a.kind === "dir") || a.name.localeCompare(b.name));
    return { projectId: id, path: rel, entries, truncated };
  }

  /** Resolves `path` to a regular file whose real path stays inside the project. */
  async resolveFile(projectId: string, path: string): Promise<{ file: ProjectFile; path: string }> {
    const { real, rel } = this.locate(projectId, path);
    const info = await stat(real);
    if (!info.isFile()) throw badRequest(`${rel || "/"} is not a regular file`);
    const name = rel.slice(rel.lastIndexOf("/") + 1);
    return { file: { name, path: rel, kind: "file", sizeBytes: info.size, modifiedAt: info.mtime.toISOString() }, path: real };
  }

  measure(projectId: string): Promise<ProjectStorage> {
    const id = this.projects.require(projectId).id;
    const cached = this.storage.get(id);
    if (cached && Date.now() - cached.at < STORAGE_TTL_MS) return cached.value;
    const value = this.scan(id);
    this.storage.set(id, { at: Date.now(), value });
    value.catch(() => this.storage.delete(id));
    return value;
  }

  /** Deletes the folders of `categories` found by a fresh scan; 409 while anything runs in the project. */
  async clear(projectId: string, categories: readonly StorageCategory[] = STORAGE_CATEGORIES): Promise<ProjectStorage> {
    const { id, path: root } = this.projects.require(projectId);
    this.projects.assertNoActiveWork(id);
    this.storage.delete(id);
    const wanted = new Set(categories);
    const targets = (await this.candidates(root)).filter((candidate) => wanted.has(candidate.category));
    for (const target of targets) {
      const full = join(root, target.path);
      const info = await lstat(full).catch(() => null);
      if (!info?.isDirectory() || !isInside(root, realpathOrNull(full) ?? "")) continue;
      await rm(full, { recursive: true, force: true });
    }
    this.logger.info("project storage cleared", { project: id, categories: [...wanted], folders: targets.length });
    return this.measure(id);
  }

  private locate(projectId: string, path: string): { id: string; root: string; real: string; rel: string } {
    const { id, path: root } = this.projects.require(projectId);
    const cleaned = path.replace(/^\/+|\/+$/g, "");
    if (cleaned.split("/").some((part) => part === "..")) throw notFound(`${path} not found`);
    const real = realpathOrNull(join(root, cleaned));
    if (!real || !isInside(root, real)) throw notFound(`${path || "/"} not found`);
    return { id, root, real, rel: toPosix(relative(root, real)) };
  }

  private async scan(id: string): Promise<ProjectStorage> {
    const root = this.projects.require(id).path;
    const candidates = await this.candidates(root);
    const [totalBytes, sizes] = await Promise.all([this.diskUsage(root), this.diskUsages(root, candidates.map((candidate) => candidate.path))]);
    const entries = STORAGE_CATEGORIES.map((category) => {
      const own = candidates.filter((candidate) => candidate.category === category);
      return {
        category,
        sizeBytes: own.reduce((sum, candidate) => sum + (sizes.get(candidate.path) ?? 0), 0),
        paths: own.map((candidate) => candidate.path),
      };
    });
    const regenerable = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
    return { projectId: id, totalBytes, sourceBytes: Math.max(0, totalBytes - regenerable), entries, measuredAt: nowIso() };
  }

  private async candidates(root: string): Promise<Candidate[]> {
    const found: Candidate[] = [];
    const queue: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
    let visited = 0;
    while (queue.length > 0 && visited < SCAN_MAX_DIRS) {
      const { dir, depth } = queue.shift()!;
      visited += 1;
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => [] as Dirent[]);
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === ".git") continue;
        const full = join(dir, entry.name);
        const category = categoryOf(entry.name);
        if (category) found.push({ category, path: toPosix(relative(root, full)) });
        else if (depth < SCAN_MAX_DEPTH) queue.push({ dir: full, depth: depth + 1 });
      }
    }
    return this.keepGenerated(root, found);
  }

  /** In a git repo only ignored folders are generated; elsewhere only dependency and cache folders are trusted. */
  private async keepGenerated(root: string, candidates: Candidate[]): Promise<Candidate[]> {
    if (candidates.length === 0) return candidates;
    const inRepo = await run(["git", "-C", root, "rev-parse", "--is-inside-work-tree"], { timeoutMs: GIT_TIMEOUT_MS });
    if (!inRepo.ok) return candidates.filter((candidate) => UNTRACKED_SAFE.has(candidate.category));
    const result = await run(["git", "-C", root, "check-ignore", "--stdin", "-z"], {
      timeoutMs: GIT_TIMEOUT_MS,
      stdin: candidates.map((candidate) => `${candidate.path}/`).join("\0"),
    });
    if (!result.ok && result.code !== 1) {
      this.logger.debug("git check-ignore failed", { root, stderr: result.stderr.slice(0, 200) });
      return [];
    }
    const ignored = new Set(result.stdout.split("\0").filter(Boolean).map((path) => path.replace(/\/$/, "")));
    return candidates.filter((candidate) => ignored.has(candidate.path));
  }

  private async diskUsages(root: string, paths: string[]): Promise<Map<string, number>> {
    const sizes = new Map<string, number>();
    for (let index = 0; index < paths.length; index += DU_BATCH) {
      const batch = paths.slice(index, index + DU_BATCH);
      const result = await run(["du", "-sk", "--", ...batch], { cwd: root, timeoutMs: DU_TIMEOUT_MS });
      for (const line of result.stdout.split("\n")) {
        const match = /^(\d+)\t(.+)$/.exec(line);
        if (match) sizes.set(match[2]!, Number(match[1]) * 1024);
      }
    }
    return sizes;
  }

  private async diskUsage(path: string): Promise<number> {
    const result = await run(["du", "-sk", "--", path], { timeoutMs: DU_TIMEOUT_MS });
    const kib = Number(/^(\d+)/.exec(result.stdout)?.[1]);
    if (!Number.isFinite(kib)) throw unavailable(`Couldn't measure the project: ${result.error ?? result.stderr.trim().slice(0, 200)}`);
    return kib * 1024;
  }
}
