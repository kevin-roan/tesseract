import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { lstat, readdir, readlink, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createId,
  isSafeSyncPath,
  LIMITS,
  type CompleteSyncRequest,
  type CreateSyncRequest,
  type SyncAck,
  type SyncChanges,
  type SyncDiscard,
  type SyncDiscardResult,
  type SyncFileChange,
  type SyncGetPlan,
  type SyncGetPlanResponse,
  type SyncHeartbeat,
  type SyncHost,
  type SyncRequest,
  type SyncRequestStatus,
  type SyncResult,
} from "@theone/protocol";
import { mapLimit } from "../core/concurrency";
import { badRequest, conflict, HttpError, notFound } from "../core/errors";
import { childEnv } from "../core/exec";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import { locateProject, realpathOrNull, type ProjectLocation } from "../core/paths";
import { nowIso } from "../core/time";
import type { Config } from "../config";
import type { Repositories } from "../db/repositories";
import type { GitService } from "./git";
import type { SyncFormat } from "./projects";
import { SyncBlobStore } from "./sync-blobs";
import {
  applyDiscard,
  applyGet,
  checkPlan,
  checkStaged,
  extractMembers,
  GIT_CONFLICT,
  GIT_DIR,
  probeAll,
  probeHash,
  sha256File,
  sha256Text,
  type DiscardStep,
  type Probe,
} from "./sync-get";

export const SYNC_REQUESTS_KEEP = 500;
export const STALE_CLAIM_ERROR = "The desktop companion stopped responding";

const HASH_CONCURRENCY = 16;
const WALK_SKIP = new Set([".git", "node_modules"]);
const HOST_FORGET_MS = 24 * 60 * 60_000;
const SWEEP_INTERVAL_MS = 30_000;

/**
 * `executable`: regular files with an executable bit (absent in baselines written before it was tracked: modes are then not compared).
 * `gotAt`: the last get since the push. `gitHead`: the sandbox repo's `ref@sha` at the last push or get (absent: not compared).
 */
type Baseline = { pushedAt: string; files: Record<string, string>; executable?: string[]; gotAt?: string; gitHead?: string | null };
type PendingGet = { plan: SyncGetPlan; upload: string[]; gitUpload: string[] };
type ManifestEntry = { sha256: string; size: number; executable: boolean };
type Manifest = Map<string, ManifestEntry>;
type CachedHash = { key: string; sha256: string };
type HostSeen = { lastSeenAt: number; projects: Set<string>; changes: Map<string, number> };

export type SyncBackOptions = {
  claimTimeoutMs?: number;
  sweepIntervalMs?: number;
  hostOnlineMs?: number;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

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
  private readonly pendingGets = new Map<string, PendingGet>();
  private readonly applying = new Set<string>();
  private readonly discarding = new Set<string>();
  private readonly blobs: SyncBlobStore;
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
    this.blobs = new SyncBlobStore(join(config.dataDir, "sync", "blobs"));
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
    this.writeBaseline(location.id, { pushedAt: nowIso(), files, executable, gitHead: await this.git.head(location.path) });
    await this.capture(location, Object.entries(files));
    await this.blobs.keepOnly(location.id, new Set(Object.values(files))).catch((error) => this.logger.warn("sync blob cleanup failed", { project: location.id, error }));
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
      const discardable = before === undefined || before === entry.sha256 || this.blobs.find(location.id, before) !== null;
      changes.push({ path, kind: before === undefined ? "added" : "modified", sha256: entry.sha256, size: entry.size, discardable });
    }
    for (const [path, before] of Object.entries(baseline.files)) {
      if (!manifest.has(path)) changes.push({ path, kind: "deleted", sha256: null, size: null, discardable: this.blobs.find(location.id, before) !== null });
    }
    changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const totalBytes = changes.reduce((sum, change) => sum + (change.size ?? 0), 0);
    return { projectId: location.id, baselineAt: baseline.pushedAt, changes, totalBytes, host, lastGetAt: baseline.gotAt ?? null };
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
    await this.capture(location, input.changes.flatMap(({ path, sha256 }) => (sha256 === null ? [] : [[path, sha256] as const])));
    this.hub.publish({ type: "sync.changed", projectId: location.id });
    return this.changes(location.id);
  }

  /** Puts sandbox files back to the baseline: `added` ones are removed, the others restored from stored blobs. */
  async discard(id: string, input: SyncDiscard): Promise<SyncDiscardResult> {
    const location = this.require(id);
    const baseline = this.requireBaseline(location.id);
    this.assertIdle(location.id);
    this.discarding.add(location.id);
    const work = join(this.config.dataDir, "sync", "staging", createId("sync"));
    try {
      const { changes } = await this.changes(location.id);
      const byPath = new Map(changes.map((change) => [change.path, change]));
      const selected = input.paths
        ? [...new Set(input.paths)].map((path) => {
            const change = byPath.get(path);
            if (!change) throw badRequest(`${path.slice(0, 200)} is not a current change`);
            return change;
          })
        : changes;
      const executable = baseline.executable ? new Set(baseline.executable) : null;
      const steps: DiscardStep[] = [];
      const unavailable: string[] = [];
      for (const change of selected) {
        if (change.kind === "added") {
          steps.push({ path: change.path, restore: null });
          continue;
        }
        const sha256 = baseline.files[change.path]!;
        const isExecutable = executable === null ? null : executable.has(change.path);
        const blob = this.blobs.find(location.id, sha256);
        if (change.sha256 === sha256 && isExecutable !== null) steps.push({ path: change.path, restore: { kind: "mode", executable: isExecutable } });
        else if (blob) steps.push({ path: change.path, restore: { kind: blob.kind, blob: blob.path, executable: blob.kind === "file" ? isExecutable : null } });
        else unavailable.push(change.path);
      }
      let backupPath: string | null = null;
      if (steps.length > 0) {
        const backupDir = join(this.config.dataDir, "sync", "backups", location.id, `discard-${nowIso().replace(/[-:.]/g, "")}`);
        ({ backupPath } = await applyDiscard({ root: location.path, work, steps, backupDir }));
        this.hub.publish({ type: "sync.changed", projectId: location.id });
      }
      return { discarded: steps.map((step) => step.path), unavailable, backupPath, changes: await this.changes(location.id) };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      this.logger.warn("sync discard failed", { project: location.id, error });
      throw new HttpError("internal", error instanceof Error ? error.message : String(error));
    } finally {
      this.discarding.delete(location.id);
      await rm(work, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Throws 409 while a `pending`/`claimed` request exists for the project. */
  assertIdle(id: string): void {
    this.sweep();
    const active = this.repos.syncRequests.where("project_id = ? AND status IN ('pending', 'claimed')", id)[0];
    if (active) throw conflict(`Sync request ${active.id} is already ${active.status} for project ${id}`);
    if (this.discarding.has(id)) throw conflict(`A discard is already running for project ${id}`);
  }

  /** Drops the baseline and its blobs once the project left the sandbox. */
  async forget(id: string): Promise<void> {
    this.hashCache.delete(id);
    await rm(this.baselinePath(id), { force: true });
    await this.blobs.removeProject(id);
    this.hub.publish({ type: "sync.changed", projectId: id });
  }

  heartbeat(input: SyncHeartbeat): void {
    const now = Date.now();
    const changes = new Map(Object.entries(input.changes ?? {}));
    const previous = this.hosts.get(input.host)?.changes ?? new Map<string, number>();
    this.hosts.set(input.host, { lastSeenAt: now, projects: new Set(input.projects), changes });
    // Clients only refetch `SyncChanges` on events, so tell them when the host's side moved.
    for (const id of new Set([...changes.keys(), ...previous.keys()])) {
      if (changes.get(id) !== previous.get(id)) this.hub.publish({ type: "sync.changed", projectId: id });
    }
    for (const [name, seen] of this.hosts) {
      if (now - seen.lastSeenAt > HOST_FORGET_MS) this.hosts.delete(name);
    }
  }

  createRequest(id: string, input: CreateSyncRequest): SyncRequest {
    const location = this.require(id);
    this.sweep();
    const active = this.repos.syncRequests.where("project_id = ? AND status IN ('pending', 'claimed')", location.id)[0];
    if (active) throw conflict(`Sync request ${active.id} is already ${active.status} for project ${location.id}`);
    if (input.kind !== "revert" && !this.readBaseline(location.id)) {
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
    this.pendingGets.delete(id);
    return this.update({ ...request, status: input.status, result: input.result ?? null, error });
  }

  /** A claimed `get`: checks the host's changes against the sandbox and says which files to send. */
  async planGet(id: string, plan: SyncGetPlan): Promise<SyncGetPlanResponse> {
    this.sweep();
    const request = this.requireGet(id);
    const location = this.require(request.projectId);
    const baseline = this.requireBaseline(location.id);
    await checkPlan(location.path, plan);
    const current = await probeAll(location.path, plan.changes);
    const conflicts = await this.getConflicts(location, baseline, plan, current);
    if (conflicts.length > 0 && !request.force) {
      this.pendingGets.delete(request.id);
      return { request: this.failGet(request, plan, conflicts), upload: [], gitUpload: [] };
    }
    const upload = plan.changes.filter((change) => change.sha256 !== null && probeHash(current.get(change.path) ?? null) !== change.sha256).map((change) => change.path);
    const gitUpload = plan.git ? [...new Set(plan.git.changed)] : [];
    this.pendingGets.set(request.id, { plan, upload, gitUpload });
    return { request: this.update(request), upload, gitUpload };
  }

  /** Applies a planned `get` from the archive of the files `planGet` asked for, and completes the request. */
  async applyGet(id: string, format: SyncFormat, archive: ReadableStream<Uint8Array>): Promise<SyncRequest> {
    this.sweep();
    const request = this.requireGet(id);
    const pending = this.pendingGets.get(request.id);
    if (!pending) throw conflict(`Sync request ${request.id} has no plan (the controller restarted?); run monolith --get again`);
    if (this.applying.has(request.id)) throw conflict(`Sync request ${request.id} is already being applied`);
    this.applying.add(request.id);
    const scratch = join(this.config.dataDir, "sync", "staging", request.id);
    try {
      const location = this.require(request.projectId);
      const { plan, upload, gitUpload } = pending;
      await rm(scratch, { recursive: true, force: true });
      const staged = join(scratch, "files");
      const expected = new Map<string, string | null>();
      for (const change of plan.changes) if (upload.includes(change.path)) expected.set(change.path, change.sha256);
      for (const path of gitUpload) expected.set(`${GIT_DIR}/${path}`, null);
      await extractMembers(archive, format === "application/gzip", staged, [...expected.keys()]);
      await checkStaged(staged, expected);

      const baseline = this.requireBaseline(location.id);
      await checkPlan(location.path, plan);
      const current = await probeAll(location.path, plan.changes);
      const conflicts = await this.getConflicts(location, baseline, plan, current);
      if (conflicts.length > 0 && !request.force) {
        this.pendingGets.delete(request.id);
        return this.failGet(request, plan, conflicts);
      }
      const outcome = await applyGet({
        root: location.path,
        staged,
        work: join(scratch, "rollback"),
        plan,
        current,
        upload: new Set(upload),
        gitUpload,
        overwritten: conflicts.filter((path) => path !== GIT_CONFLICT),
        backupDir: join(this.config.dataDir, "sync", "backups", location.id, request.id),
      });

      const syncedAt = nowIso();
      const next = this.readBaseline(location.id) ?? baseline;
      const executable = new Set(next.executable ?? []);
      for (const change of plan.changes) {
        if (change.sha256 === null) {
          delete next.files[change.path];
          executable.delete(change.path);
        } else {
          next.files[change.path] = change.sha256;
          if (change.executable) executable.add(change.path);
          else executable.delete(change.path);
        }
      }
      if (next.executable) next.executable = [...executable].sort();
      this.writeBaseline(location.id, { ...next, gotAt: syncedAt, gitHead: await this.git.head(location.path) });
      await this.capture(location, plan.changes.flatMap(({ path, sha256 }) => (sha256 === null ? [] : [[path, sha256] as const])));
      this.hub.publish({ type: "sync.changed", projectId: location.id });

      const count = (kind: SyncFileChange["kind"]) => outcome.files.filter((file) => file.kind === kind).length;
      const result: SyncResult = {
        added: count("added"),
        modified: count("modified"),
        deleted: count("deleted"),
        conflicts: request.force ? conflicts : [],
        snapshotId: null,
        hostPath: plan.hostPath,
        files: outcome.files,
        insertions: outcome.files.reduce((sum, file) => sum + file.insertions, 0),
        deletions: outcome.files.reduce((sum, file) => sum + file.deletions, 0),
        gitFiles: outcome.gitFiles,
        syncedAt,
        previousSyncAt: baseline.gotAt ?? baseline.pushedAt,
        backupPath: outcome.backupPath,
      };
      this.pendingGets.delete(request.id);
      return this.update({ ...this.requireGet(request.id), status: "applied", result, error: null });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      this.logger.warn("sync get failed", { request: request.id, error });
      throw new HttpError("internal", error instanceof Error ? error.message : String(error));
    } finally {
      this.applying.delete(request.id);
      await rm(scratch, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  cancel(id: string): SyncRequest {
    const request = this.requireRequest(id, "pending");
    this.pendingGets.delete(id);
    return this.update({ ...request, status: "cancelled" });
  }

  /** Fails requests claimed longer than the claim timeout ago; returns them. */
  sweep(now = Date.now()): SyncRequest[] {
    const cutoff = new Date(now - this.claimTimeoutMs).toISOString();
    return this.repos.syncRequests
      .where("status = 'claimed' AND updated_at < ?", cutoff)
      .filter((request) => !this.applying.has(request.id))
      .map((request) => {
        this.pendingGets.delete(request.id);
        return this.update({ ...request, status: "failed", error: STALE_CLAIM_ERROR });
      });
  }

  /** Planned paths edited in the sandbox since the last sync (and not already the host's version), plus `.git` when its HEAD moved. */
  private async getConflicts(location: ProjectLocation, baseline: Baseline, plan: SyncGetPlan, current: Map<string, Probe>): Promise<string[]> {
    const conflicts = plan.changes
      .filter((change) => {
        const now = probeHash(current.get(change.path) ?? null);
        return now !== (baseline.files[change.path] ?? null) && now !== change.sha256;
      })
      .map((change) => change.path);
    const touchesGit = plan.git !== null && plan.git.changed.length + plan.git.deleted.length > 0;
    if (touchesGit && baseline.gitHead !== undefined && (await this.git.head(location.path)) !== baseline.gitHead) conflicts.push(GIT_CONFLICT);
    return conflicts;
  }

  private failGet(request: SyncRequest, plan: SyncGetPlan, conflicts: string[]): SyncRequest {
    const files = conflicts.filter((path) => path !== GIT_CONFLICT);
    const reasons = [
      ...(files.length > 0 ? [`${plural(files.length, "file")} changed in the sandbox since the last sync: ${files.slice(0, 5).join(", ")}${files.length > 5 ? ", …" : ""}`] : []),
      ...(files.length < conflicts.length ? ["the sandbox repository has new commits or another branch checked out"] : []),
    ];
    const result: SyncResult = { added: 0, modified: 0, deleted: 0, conflicts, snapshotId: null, hostPath: plan.hostPath };
    return this.update({ ...request, status: "failed", result, error: `Nothing was changed: ${reasons.join("; ")}` });
  }

  private requireGet(id: string): SyncRequest {
    const request = this.requireRequest(id, "claimed");
    if (request.kind !== "get") throw conflict(`Sync request ${id} is a ${request.kind}, not a get`);
    return request;
  }

  private requireBaseline(projectId: string): Baseline {
    const baseline = this.readBaseline(projectId);
    if (!baseline) throw badRequest(`Project ${projectId} has not been pushed yet; run monolith --sync first`);
    return baseline;
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
    const changes = best.seen.changes.get(projectId);
    return {
      name: best.name,
      lastSeenAt: new Date(best.seen.lastSeenAt).toISOString(),
      online: Date.now() - best.seen.lastSeenAt < this.hostOnlineMs,
      linked: best.linked,
      ...(changes === undefined ? {} : { changes }),
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
      return {
        pushedAt: parsed.pushedAt,
        files: { ...parsed.files },
        ...(executable ? { executable } : {}),
        ...(typeof parsed.gotAt === "string" ? { gotAt: parsed.gotAt } : {}),
        ...(typeof parsed.gitHead === "string" || parsed.gitHead === null ? { gitHead: parsed.gitHead } : {}),
      };
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

  /** Stores the baseline content of `entries` whose sandbox file still has that hash; a failure only costs discardability. */
  private async capture(location: ProjectLocation, entries: readonly (readonly [string, string])[]): Promise<void> {
    await mapLimit(entries, HASH_CONCURRENCY, async ([path, sha256]) => {
      if (!this.insideProject(location.path, path)) return;
      try {
        await this.blobs.capture(location.id, join(location.path, path), sha256);
      } catch (error) {
        this.logger.warn("could not store a sync baseline blob", { project: location.id, path, error });
      }
    });
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
