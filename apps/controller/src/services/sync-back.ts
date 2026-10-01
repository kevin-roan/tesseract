import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { lstat, readdir, readlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createId,
  isSafeSyncPath,
  LIMITS,
  type CompleteSyncRequest,
  type CreateSyncRequest,
  type SyncAck,
  type SyncChanges,
  type SyncFileChange,
  type SyncHeartbeat,
  type SyncHost,
  type SyncRequest,
  type SyncRequestStatus,
} from "@theone/protocol";
import { mapLimit } from "../core/concurrency";
import { badRequest, conflict, notFound } from "../core/errors";
import { childEnv } from "../core/exec";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import { locateProject, realpathOrNull, type ProjectLocation } from "../core/paths";
import { nowIso } from "../core/time";
import type { Config } from "../config";
import type { Repositories } from "../db/repositories";
import type { GitService } from "./git";

export const SYNC_REQUESTS_KEEP = 500;
export const STALE_CLAIM_ERROR = "The desktop companion stopped responding";

const HASH_CONCURRENCY = 16;
const WALK_SKIP = new Set([".git", "node_modules"]);
const HOST_FORGET_MS = 24 * 60 * 60_000;
const SWEEP_INTERVAL_MS = 30_000;

/** `executable`: regular files with an executable bit (absent in baselines written before it was tracked: modes are then not compared). */
type Baseline = { pushedAt: string; files: Record<string, string>; executable?: string[] };
type ManifestEntry = { sha256: string; size: number; executable: boolean };
type Manifest = Map<string, ManifestEntry>;
type CachedHash = { key: string; sha256: string };
type HostSeen = { lastSeenAt: number; projects: Set<string> };

export type SyncBackOptions = {
  claimTimeoutMs?: number;
  sweepIntervalMs?: number;
  hostOnlineMs?: number;
};

const sha256Text = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
}

async function walk(root: string): Promise<string[]> {
  const files: string[] = [];
  const pending = [""];
  while (pending.length > 0) {
    const rel = pending.pop()!;
    let entries;
    try {
      entries = await readdir(join(root, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!WALK_SKIP.has(entry.name)) pending.push(path);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(path);
      }
    }
  }
  return files;
}

/**
 * Sync back (sandbox → host): the manifest recorded after a push, the changes made since,
 * the tar export of changed files, and the queue of sync requests the desktop companion applies.
 */
export class SyncBackService {
  private readonly hashCache = new Map<string, Map<string, CachedHash>>();
  private readonly hosts = new Map<string, HostSeen>();
  private readonly claimTimeoutMs: number;
  private readonly sweepIntervalMs: number;
  private readonly hostOnlineMs: number;
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: Config,
    private readonly git: GitService,
    private readonly repos: Repositories,
    private readonly hub: EventHub,
    private readonly logger: Logger,
    options: SyncBackOptions = {},
  ) {
    this.claimTimeoutMs = options.claimTimeoutMs ?? LIMITS.syncClaimTimeoutMs;
    this.sweepIntervalMs = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS;
    this.hostOnlineMs = options.hostOnlineMs ?? LIMITS.syncHostOnlineMs;
  }

  start(): void {
    this.sweep();
    this.sweeper ??= setInterval(() => this.sweep(), this.sweepIntervalMs);
    this.sweeper.unref?.();
  }

  stop(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }

  async recordBaseline(id: string): Promise<void> {
    const location = this.require(id);
    const manifest = await this.manifest(location);
    const files: Record<string, string> = {};
    const executable: string[] = [];
    for (const [path, entry] of manifest) {
      files[path] = entry.sha256;
      if (entry.executable) executable.push(path);
    }
    this.writeBaseline(location.id, { pushedAt: nowIso(), files, executable });
    this.hub.publish({ type: "sync.changed", projectId: location.id });
  }

  async changes(id: string): Promise<SyncChanges> {
    const location = this.require(id);
    const baseline = this.readBaseline(location.id);
    const host = this.hostFor(location.id);
    if (!baseline) return { projectId: location.id, baselineAt: null, changes: [], totalBytes: 0, host };
    const manifest = await this.manifest(location);
    const changes: SyncFileChange[] = [];
    const executable = baseline.executable ? new Set(baseline.executable) : null;
    for (const [path, entry] of manifest) {
      const before = baseline.files[path];
      if (before === entry.sha256 && (executable === null || executable.has(path) === entry.executable)) continue;
      changes.push({ path, kind: before === undefined ? "added" : "modified", sha256: entry.sha256, size: entry.size });
    }
    for (const path of Object.keys(baseline.files)) {
      if (!manifest.has(path)) changes.push({ path, kind: "deleted", sha256: null, size: null });
    }
    changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const totalBytes = changes.reduce((sum, change) => sum + (change.size ?? 0), 0);
    return { projectId: location.id, baselineAt: baseline.pushedAt, changes, totalBytes, host };
  }

  /** A gzip tar of `paths`, each of which must be a current `added` or `modified` change. */
  async export(id: string, paths: readonly string[]): Promise<ReadableStream<Uint8Array>> {
    const location = this.require(id);
    const { baselineAt, changes } = await this.changes(location.id);
    if (baselineAt === null) throw badRequest(`Project ${location.id} has not been pushed yet`);
    const exportable = new Set(changes.filter((change) => change.kind !== "deleted").map((change) => change.path));
    const unique = [...new Set(paths)];
    for (const path of unique) {
      if (!isSafeSyncPath(path) || !exportable.has(path) || !this.insideProject(location.path, path)) {
        throw badRequest(`${path.slice(0, 200)} is not a current added or modified change`);
      }
    }
    const tar = Bun.spawn(
      ["tar", "-c", "-z", "-f", "-", "--no-recursion", "--hard-dereference", "--null", "--verbatim-files-from", "-T", "-"],
      { cwd: location.path, env: childEnv(), stdin: "pipe", stdout: "pipe", stderr: "pipe" },
    );
    tar.stdin.write(unique.map((path) => `${path}\0`).join(""));
    void tar.stdin.end();
    void Promise.all([new Response(tar.stderr).text(), tar.exited]).then(([stderr, code]) => {
      if (code !== 0) this.logger.warn("sync export tar failed", { project: location.id, code, stderr: stderr.trim().slice(0, 500) });
    });
    return tar.stdout;
  }

  async ack(id: string, input: SyncAck): Promise<SyncChanges> {
    const location = this.require(id);
    const baseline = this.readBaseline(location.id);
    if (!baseline) throw badRequest(`Project ${location.id} has not been pushed yet`);
    const current = input.changes.some((change) => change.sha256 !== null && change.executable === undefined) ? await this.manifest(location) : null;
    const executable = new Set(baseline.executable ?? []);
    for (const { path, sha256, executable: flag } of input.changes) {
      if (sha256 === null) {
        delete baseline.files[path];
        executable.delete(path);
        continue;
      }
      baseline.files[path] = sha256;
      const entry = current?.get(path);
      const isExecutable = flag ?? (entry?.sha256 === sha256 ? entry.executable : executable.has(path));
      if (isExecutable) executable.add(path);
      else executable.delete(path);
    }
    if (baseline.executable) baseline.executable = [...executable].sort();
    this.writeBaseline(location.id, baseline);
    this.hub.publish({ type: "sync.changed", projectId: location.id });
    return this.changes(location.id);
  }

  heartbeat(input: SyncHeartbeat): void {
    const now = Date.now();
    this.hosts.set(input.host, { lastSeenAt: now, projects: new Set(input.projects) });
    for (const [name, seen] of this.hosts) {
      if (now - seen.lastSeenAt > HOST_FORGET_MS) this.hosts.delete(name);
    }
  }

  createRequest(id: string, input: CreateSyncRequest): SyncRequest {
    const location = this.require(id);
    this.sweep();
    const active = this.repos.syncRequests.where("project_id = ? AND status IN ('pending', 'claimed')", location.id)[0];
    if (active) throw conflict(`Sync request ${active.id} is already ${active.status} for project ${location.id}`);
    if (input.kind === "pull" && !this.readBaseline(location.id)) {
      throw badRequest(`Project ${location.id} has not been pushed yet; run monolith --sync first`);
    }
    const now = nowIso();
    const request: SyncRequest = {
      id: createId("sync"),
      projectId: location.id,
      kind: input.kind,
      status: "pending",
      paths: input.paths ? [...new Set(input.paths)] : null,
      force: input.force ?? false,
      source: input.source ?? "mobile",
      claimedBy: null,
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.repos.syncRequests.save(request);
    this.repos.pruneSyncRequests(SYNC_REQUESTS_KEEP);
    this.hub.publish({ type: "sync.updated", request });
    return request;
  }

  projectRequests(id: string): SyncRequest[] {
    const location = this.require(id);
    this.sweep();
    return this.repos.syncRequests.list({ projectId: location.id, limit: LIMITS.maxSyncRequestList });
  }

  requests(status?: SyncRequestStatus): SyncRequest[] {
    this.sweep();
    return status === undefined
      ? this.repos.syncRequests.list({ limit: LIMITS.maxSyncRequestList })
      : this.repos.syncRequests.where("status = ?", status).slice(0, LIMITS.maxSyncRequestList);
  }

  claim(id: string, host: string): SyncRequest {
    this.sweep();
    const request = this.requireRequest(id, "pending");
    return this.update({ ...request, status: "claimed", claimedBy: host });
  }

  complete(id: string, input: CompleteSyncRequest): SyncRequest {
    this.sweep();
    const request = this.requireRequest(id, "claimed");
    const error = input.status === "failed" ? (input.error ?? "Sync failed") : (input.error ?? null);
    return this.update({ ...request, status: input.status, result: input.result ?? null, error });
  }

  cancel(id: string): SyncRequest {
    const request = this.requireRequest(id, "pending");
    return this.update({ ...request, status: "cancelled" });
  }

  /** Fails requests claimed longer than the claim timeout ago; returns them. */
  sweep(now = Date.now()): SyncRequest[] {
    const cutoff = new Date(now - this.claimTimeoutMs).toISOString();
    return this.repos.syncRequests
      .where("status = 'claimed' AND updated_at < ?", cutoff)
      .map((request) => this.update({ ...request, status: "failed", error: STALE_CLAIM_ERROR }));
  }

  private update(request: SyncRequest): SyncRequest {
    const next = { ...request, updatedAt: nowIso() };
    this.repos.syncRequests.save(next);
    this.hub.publish({ type: "sync.updated", request: next });
    return next;
  }

  private requireRequest(id: string, status: SyncRequestStatus): SyncRequest {
    const request = this.repos.syncRequests.get(id);
    if (!request) throw notFound(`Sync request ${id} not found`);
    if (request.status !== status) throw conflict(`Sync request ${id} is ${request.status}, not ${status}`);
    return request;
  }

  private hostFor(projectId: string): SyncHost | null {
    let best: { name: string; seen: HostSeen; linked: boolean } | null = null;
    for (const [name, seen] of this.hosts) {
      const linked = seen.projects.has(projectId);
      if (!best || (linked && !best.linked) || (linked === best.linked && seen.lastSeenAt > best.seen.lastSeenAt)) {
        best = { name, seen, linked };
      }
    }
    if (!best) return null;
    return {
      name: best.name,
      lastSeenAt: new Date(best.seen.lastSeenAt).toISOString(),
      online: Date.now() - best.seen.lastSeenAt < this.hostOnlineMs,
      linked: best.linked,
    };
  }

  private require(id: string): ProjectLocation {
    const location = locateProject(this.config.projectsDir, id);
    if (!location.exists) throw notFound(`Project ${location.id} not found`);
    return location;
  }

  private baselinePath(projectId: string): string {
    return join(this.config.dataDir, "sync", `${projectId}.json`);
  }

  private readBaseline(projectId: string): Baseline | null {
    try {
      const parsed = JSON.parse(readFileSync(this.baselinePath(projectId), "utf8")) as Partial<Baseline>;
      if (typeof parsed.pushedAt !== "string" || typeof parsed.files !== "object" || parsed.files === null) return null;
      const executable = Array.isArray(parsed.executable) ? parsed.executable.filter((path) => typeof path === "string") : undefined;
      return { pushedAt: parsed.pushedAt, files: { ...parsed.files }, ...(executable ? { executable } : {}) };
    } catch {
      return null;
    }
  }

  private writeBaseline(projectId: string, baseline: Baseline): void {
    const path = this.baselinePath(projectId);
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const temp = `${path}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(baseline), { mode: 0o600 });
    renameSync(temp, path);
  }

  /** `path`'s parent resolves to itself under the project root (no symlinked directories on the way). */
  private insideProject(root: string, path: string): boolean {
    const parent = dirname(join(root, path));
    return realpathOrNull(parent) === parent;
  }

  private async manifest(location: ProjectLocation): Promise<Manifest> {
    const root = location.path;
    const listed = (await this.git.listFiles(root)) ?? (await walk(root));
    const previous = this.hashCache.get(location.id) ?? new Map<string, CachedHash>();
    const cache = new Map<string, CachedHash>();
    const entries = await mapLimit(listed.filter(isSafeSyncPath), HASH_CONCURRENCY, async (path) => {
      const entry = await this.entry(root, path, previous, cache);
      return entry ? ([path, entry] as const) : null;
    });
    this.hashCache.set(location.id, cache);
    return new Map(entries.filter((entry) => entry !== null).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }

  private async entry(root: string, path: string, previous: Map<string, CachedHash>, cache: Map<string, CachedHash>): Promise<ManifestEntry | null> {
    if (!this.insideProject(root, path)) return null;
    const full = join(root, path);
    try {
      const stats = await lstat(full);
      if (stats.isSymbolicLink()) {
        const target = await readlink(full);
        return { sha256: sha256Text(target), size: Buffer.byteLength(target), executable: false };
      }
      if (!stats.isFile()) return null;
      const key = `${stats.ino}:${stats.size}:${stats.mtimeMs}:${stats.ctimeMs}`;
      const known = previous.get(path);
      const sha256 = known?.key === key ? known.sha256 : await sha256File(full);
      cache.set(path, { key, sha256 });
      return { sha256, size: stats.size, executable: (stats.mode & 0o111) !== 0 };
    } catch (error) {
      this.logger.debug("sync manifest skipped a file", { path, error });
      return null;
    }
  }
}
