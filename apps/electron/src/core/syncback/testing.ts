import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ApiError } from "@tesseract/client";
import type {
  CompleteSyncRequest,
  CreateSyncRequest,
  SyncAck,
  SyncChanges,
  SyncGetPlan,
  SyncGetPlanResponse,
  SyncHeartbeat,
  SyncRequest,
} from "@tesseract/protocol";
import type { ByteStream, PushResult, SyncApi } from "./api";
import { buildManifest, type Manifest } from "./manifest";
import { fileSource, readTar, TarWriter, type TarMember } from "./tar";

export const PROJECT = "demo";
export const BASELINE_AT = "2026-09-30T20:00:00.000Z";
export const SYNCED_AT = "2026-10-01T12:00:00.000Z";

export async function tempDir(label: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `tesseract-test-${label}-`));
}

export async function walk(root: string, base = ""): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    entries = await readdir(join(root, base), { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name !== ".git") found.push(...(await walk(root, rel)));
    } else {
      found.push(rel);
    }
  }
  return found;
}

export async function tree(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const path of (await walk(root)).sort()) {
    try {
      result[path] = await readFile(join(root, path), "utf8");
    } catch {
      result[path] = "<unreadable>";
    }
  }
  return result;
}

export async function write(root: string, rel: string, text: string): Promise<void> {
  await mkdir(dirname(join(root, rel)), { recursive: true });
  await writeFile(join(root, rel), text);
}

async function* single(chunk: Uint8Array): AsyncGenerator<Uint8Array> {
  yield chunk;
}

export async function tarBytes(build: (writer: TarWriter) => Promise<void>): Promise<Buffer> {
  const dir = await tempDir("tar");
  try {
    const file = join(dir, "archive.tar.gz");
    const writer = new TarWriter(file);
    await build(writer);
    await writer.close();
    return await readFile(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function readArchive(source: ByteStream): Promise<{ members: Map<string, TarMember>; contents: Map<string, Buffer> }> {
  const members = new Map<string, TarMember>();
  const contents = new Map<string, Buffer>();
  await readTar(source, async (member, body) => {
    members.set(member.name, member);
    if (!member.isRegular) return;
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(chunk);
    contents.set(member.name, Buffer.concat(chunks));
  });
  return { members, contents };
}

export class FakeController implements SyncApi {
  baseline: Manifest | null = null;
  readonly acks: SyncAck["changes"][] = [];
  exportOverride: Uint8Array | null = null;
  changesOverride: ((projectId: string) => SyncChanges) | null = null;
  readonly requests = new Map<string, SyncRequest>();
  readonly heartbeats: SyncHeartbeat[] = [];
  readonly plans: SyncGetPlan[] = [];
  readonly archives: Map<string, TarMember>[] = [];
  contents = new Map<string, Buffer>();
  readonly completed: [string, string][] = [];
  conflicts: string[] = [];
  upload: string[] | null = null;
  gitUpload: string[] | null = null;
  applyStatus: "applied" | "failed" = "applied";
  beforeApply: (() => Promise<void>) | null = null;
  planFailure: Error | null = null;
  pushes: { projectId: string; confidential: boolean; members: Map<string, TarMember> }[] = [];

  constructor(readonly sandbox: string) {}

  async push(): Promise<void> {
    this.baseline = await buildManifest(this.sandbox, await walk(this.sandbox));
  }

  async syncChanges(projectId: string): Promise<SyncChanges> {
    if (this.changesOverride) return this.changesOverride(projectId);
    if (this.baseline === null) return { projectId, baselineAt: null, changes: [], totalBytes: 0, host: null };
    const current = await buildManifest(this.sandbox, await walk(this.sandbox));
    const changes: SyncChanges["changes"] = [];
    for (const path of [...new Set([...Object.keys(current), ...Object.keys(this.baseline)])].sort()) {
      const before = this.baseline[path];
      const after = current[path];
      if (before === after) continue;
      const kind = before === undefined ? "added" : after === undefined ? "deleted" : "modified";
      const size = after ? (await stat(join(this.sandbox, path))).size : null;
      changes.push({ path, kind, sha256: after ?? null, size });
    }
    const totalBytes = changes.reduce((sum, change) => sum + (change.size ?? 0), 0);
    return { projectId, baselineAt: BASELINE_AT, changes, totalBytes, host: null };
  }

  async syncExport(_projectId: string, paths: string[]): Promise<ByteStream> {
    if (this.exportOverride) return single(this.exportOverride);
    return single(await tarBytes(async (writer) => {
      for (const path of paths) await writer.addPath(join(this.sandbox, path), path);
    }));
  }

  async syncAck(projectId: string, changes: SyncAck["changes"]): Promise<SyncChanges> {
    this.acks.push(changes);
    for (const change of changes) {
      if (!this.baseline) continue;
      if (change.sha256 === null) delete this.baseline[change.path];
      else this.baseline[change.path] = change.sha256;
    }
    return this.syncChanges(projectId);
  }

  addRequest(kind: SyncRequest["kind"], force = false, paths: string[] | null = null): SyncRequest {
    const request: SyncRequest = {
      id: `sync_${this.requests.size + 1}`,
      projectId: PROJECT,
      kind,
      status: "pending",
      paths,
      force,
      source: "mobile",
      claimedBy: null,
      result: null,
      error: null,
      createdAt: BASELINE_AT,
      updatedAt: BASELINE_AT,
    };
    this.requests.set(request.id, request);
    return { ...request };
  }

  private stored(id: string): SyncRequest {
    const request = this.requests.get(id);
    if (!request) throw new ApiError(404, "not_found", "no such request");
    return request;
  }

  async claimRequest(requestId: string, host: string): Promise<SyncRequest> {
    const request = this.stored(requestId);
    if (request.status !== "pending") throw new ApiError(409, "conflict", "not pending");
    Object.assign(request, { status: "claimed", claimedBy: host });
    return { ...request };
  }

  async completeRequest(requestId: string, body: CompleteSyncRequest): Promise<SyncRequest> {
    const request = this.stored(requestId);
    if (request.status !== "claimed") throw new Error(`request ${requestId} is ${request.status}`);
    this.completed.push([requestId, body.status]);
    Object.assign(request, { status: body.status, result: body.result ?? null, error: body.error ?? null });
    return { ...request };
  }

  async planGet(requestId: string, plan: SyncGetPlan): Promise<SyncGetPlanResponse> {
    if (this.planFailure) throw this.planFailure;
    JSON.stringify(plan);
    this.plans.push(plan);
    const request = this.stored(requestId);
    if (this.conflicts.length) {
      const result = { added: 0, modified: 0, deleted: 0, conflicts: this.conflicts, snapshotId: null, hostPath: plan.hostPath };
      Object.assign(request, { status: "failed", result, error: `${this.conflicts.length} files changed in the sandbox` });
      return { request: { ...request }, upload: [], gitUpload: [] };
    }
    const upload = this.upload ?? plan.changes.filter((change) => change.kind !== "deleted").map((change) => change.path);
    const gitUpload = this.gitUpload ?? (plan.git ? plan.git.changed : []);
    if (this.beforeApply) await this.beforeApply();
    return { request: { ...request }, upload, gitUpload };
  }

  async applyGet(requestId: string, archiveFile: string): Promise<SyncRequest> {
    const { members, contents } = await readArchive(fileSource(archiveFile));
    this.archives.push(members);
    this.contents = contents;
    const request = this.stored(requestId);
    const plan = this.plans[this.plans.length - 1] as SyncGetPlan;
    const count = (kind: string) => plan.changes.filter((change) => change.kind === kind).length;
    const counts = { added: count("added"), modified: count("modified"), deleted: count("deleted") };
    if (this.applyStatus === "failed") {
      Object.assign(request, {
        status: "failed",
        error: "1 file changed in the sandbox",
        result: { ...counts, conflicts: ["README.md"], snapshotId: null, hostPath: plan.hostPath },
      });
    } else {
      Object.assign(request, {
        status: "applied",
        result: {
          ...counts,
          conflicts: [],
          snapshotId: null,
          hostPath: plan.hostPath,
          insertions: 3,
          deletions: 1,
          gitFiles: plan.git ? plan.git.changed.length : 0,
          syncedAt: SYNCED_AT,
          previousSyncAt: BASELINE_AT,
          backupPath: null,
        },
      });
    }
    return { ...request };
  }

  async heartbeat(body: SyncHeartbeat): Promise<void> {
    this.heartbeats.push(body);
  }

  async pendingRequests(): Promise<SyncRequest[]> {
    return [...this.requests.values()].filter((request) => request.status === "pending").map((request) => ({ ...request }));
  }

  async createRequest(projectId: string, body: CreateSyncRequest): Promise<SyncRequest> {
    const request = this.addRequest(body.kind, body.force ?? false, body.paths ?? null);
    const stored = this.stored(request.id);
    Object.assign(stored, { projectId, source: body.source ?? "desktop" });
    return { ...stored };
  }

  async projectIds(): Promise<string[]> {
    return [PROJECT];
  }

  async pushProject(projectId: string, archiveFile: string, confidential: boolean): Promise<PushResult> {
    const { members } = await readArchive(fileSource(archiveFile));
    this.pushes.push({ projectId, confidential, members });
    return { project: { path: `/workspace/projects/${projectId}` }, created: true };
  }
}
