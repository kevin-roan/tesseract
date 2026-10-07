import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { DIR_MODE, LINKS_LOCK, STATE_FILE_MODE, SYNC_STATE } from "./constants";
import { errnoCode } from "./errors";
import { IS_WINDOWS, fsyncDir, writeAtomic } from "./fsutil";
import { withFileLock } from "./lock";
import type { Manifest } from "./manifest";
import type { GitManifest } from "./tree";
import { byCodePoint, sorted } from "./tree";

export type Before = "file" | "absent";

export interface Link {
  projectId: string;
  hostPath: string;
  pushedAt: string;
  manifest: Manifest;
  executable: string[] | null;
  gitManifest: GitManifest | null;
  gotAt: string | null;
  confidential: boolean;
}

export interface SnapshotEntry {
  path: string;
  before: Before;
  after_sha256: string | null;
  manifest_before: string | null;
  baseline_known: boolean;
}

export interface Snapshot {
  id: string;
  projectId: string;
  hostPath: string;
  createdAt: string;
  entries: SnapshotEntry[];
  kind: string;
  reverted: boolean;
  directory: string;
}

type JsonObject = Record<string, unknown>;

const NON_ASCII = /[\u0080-\uffff]/g;

export function pythonJson(data: unknown): string {
  const text = JSON.stringify(data, null, 2).replace(NON_ASCII, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `${text}\n`;
}

export function iso(moment: Date): string {
  return moment.toISOString();
}

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

export function snapshotStem(moment: Date): string {
  return `${moment.getFullYear()}${pad(moment.getMonth() + 1)}${pad(moment.getDate())}-${pad(moment.getHours())}${pad(moment.getMinutes())}${pad(moment.getSeconds())}`;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): Record<string, string> | null {
  if (!isObject(value)) return null;
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) if (typeof item === "string") result[key] = item;
  return result;
}

export function linkFromJson(projectId: string, data: unknown): Link | null {
  if (!isObject(data) || typeof data.hostPath !== "string") return null;
  const { executable, gotAt } = data;
  return {
    projectId,
    hostPath: data.hostPath,
    pushedAt: data.pushedAt ? String(data.pushedAt) : "",
    manifest: strings(data.manifest) ?? {},
    executable: Array.isArray(executable) ? executable.filter((path): path is string => typeof path === "string") : null,
    gitManifest: strings(data.gitManifest),
    gotAt: typeof gotAt === "string" ? gotAt : null,
    confidential: data.confidential === true,
  };
}

export function linkToJson(link: Link): JsonObject {
  const data: JsonObject = { hostPath: link.hostPath, pushedAt: link.pushedAt, manifest: link.manifest };
  if (link.executable !== null) data.executable = link.executable;
  if (link.gitManifest !== null) data.gitManifest = link.gitManifest;
  if (link.gotAt !== null) data.gotAt = link.gotAt;
  if (link.confidential) data.confidential = true;
  return data;
}

export function newLink(fields: Pick<Link, "projectId" | "hostPath" | "pushedAt"> & Partial<Link>): Link {
  return { manifest: {}, executable: null, gitManifest: null, gotAt: null, confidential: false, ...fields };
}

export function sharedPath(link: Link): string {
  return link.confidential ? SYNC_STATE.redacted : link.hostPath;
}

export function redactText(link: Link, text: string): string {
  if (!link.confidential) return text;
  return text.split(link.hostPath).join(SYNC_STATE.redacted).split(basename(link.hostPath)).join(SYNC_STATE.redacted);
}

export function snapshotToJson(snapshot: Snapshot): JsonObject {
  return {
    id: snapshot.id,
    projectId: snapshot.projectId,
    hostPath: snapshot.hostPath,
    createdAt: snapshot.createdAt,
    entries: snapshot.entries.map((entry) => {
      const data: JsonObject = { path: entry.path, before: entry.before, after_sha256: entry.after_sha256 };
      if (entry.baseline_known) data.manifest_before = entry.manifest_before;
      return data;
    }),
    kind: snapshot.kind,
    reverted: snapshot.reverted,
  };
}

function requireString(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("expected a string");
  return value;
}

export function snapshotFromJson(data: unknown, directory: string): Snapshot {
  if (!isObject(data)) throw new TypeError("expected an object");
  const entries = data.entries === undefined ? [] : data.entries;
  if (!Array.isArray(entries)) throw new TypeError("expected a list");
  return {
    id: requireString(data.id),
    projectId: requireString(data.projectId),
    hostPath: requireString(data.hostPath),
    createdAt: requireString(data.createdAt),
    entries: entries.map((entry): SnapshotEntry => {
      if (!isObject(entry)) throw new TypeError("expected an object");
      const after = entry.after_sha256;
      const before = entry.manifest_before;
      return {
        path: requireString(entry.path),
        before: requireString(entry.before) as Before,
        after_sha256: typeof after === "string" ? after : null,
        manifest_before: typeof before === "string" ? before : null,
        baseline_known: "manifest_before" in entry,
      };
    }),
    kind: typeof data.kind === "string" ? data.kind : "pull",
    reverted: Boolean(data.reverted),
    directory,
  };
}

export function savedCopy(snapshot: Snapshot, rel: string): string {
  return join(snapshot.directory, SYNC_STATE.filesDir, rel);
}

export function displacedCopy(snapshot: Snapshot, rel: string): string {
  return join(snapshot.directory, SYNC_STATE.displacedDir, rel);
}

export function samePath(a: string, b: string): boolean {
  if (!IS_WINDOWS) return a === b;
  const normalize = (path: string) => path.replace(/^([a-z]):/, (_match, drive: string) => `${drive.toUpperCase()}:`);
  return normalize(a) === normalize(b);
}

export class SyncState {
  constructor(readonly root: string) {}

  get linksPath(): string {
    return join(this.root, SYNC_STATE.linksFile);
  }

  private async readLinksData(): Promise<JsonObject> {
    try {
      const data: unknown = JSON.parse(await readFile(this.linksPath, "utf8"));
      return isObject(data) ? data : {};
    } catch {
      return {};
    }
  }

  async links(): Promise<Map<string, Link>> {
    const result = new Map<string, Link>();
    for (const [projectId, raw] of Object.entries(await this.readLinksData())) {
      const link = linkFromJson(projectId, raw);
      if (link) result.set(projectId, link);
    }
    return result;
  }

  async link(projectId: string): Promise<Link | null> {
    return (await this.links()).get(projectId) ?? null;
  }

  async linkForPath(hostPath: string): Promise<Link | null> {
    for (const link of (await this.links()).values()) if (samePath(link.hostPath, hostPath)) return link;
    return null;
  }

  private async writeLinks(data: JsonObject): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: DIR_MODE });
    await writeAtomic(this.linksPath, pythonJson(data), STATE_FILE_MODE);
  }

  private mutateLinks(mutate: (data: JsonObject) => boolean | void): Promise<void> {
    return this.lock(LINKS_LOCK, async () => {
      const data = await this.readLinksData();
      if (mutate(data) !== false) await this.writeLinks(data);
    });
  }

  saveLink(link: Link, replaces: string | null = null): Promise<void> {
    return this.mutateLinks((data) => {
      if (replaces !== null) delete data[replaces];
      data[link.projectId] = linkToJson(link);
    });
  }

  updateManifest(projectId: string, changes: Record<string, string | null>, executable?: Record<string, boolean>): Promise<void> {
    return this.mutateLinks((data) => {
      const link = linkFromJson(projectId, data[projectId]);
      if (!link) return false;
      const bits = new Set(link.executable ?? []);
      for (const [path, digest] of Object.entries(changes)) {
        if (digest === null) {
          delete link.manifest[path];
          bits.delete(path);
        } else {
          link.manifest[path] = digest;
        }
        if (executable && path in executable) {
          if (executable[path]) bits.add(path);
          else bits.delete(path);
        }
      }
      if (link.executable !== null) link.executable = sorted(bits);
      data[projectId] = linkToJson(link);
    });
  }

  recordGet(projectId: string, manifest: Manifest, executable: string[], gitManifest: GitManifest | null, gotAt: string): Promise<void> {
    return this.mutateLinks((data) => {
      const link = linkFromJson(projectId, data[projectId]);
      if (!link) return false;
      data[projectId] = linkToJson({ ...link, manifest: { ...manifest }, executable: [...executable], gitManifest, gotAt });
    });
  }

  lock<T>(name: string, work: () => Promise<T>): Promise<T> {
    return withFileLock(join(this.root, SYNC_STATE.locksDir), name, work);
  }

  projectLock<T>(projectId: string, work: () => Promise<T>): Promise<T> {
    return this.lock(projectId, work);
  }

  snapshotsDir(projectId: string): string {
    return join(this.root, SYNC_STATE.snapshotsDir, projectId);
  }

  async snapshots(projectId: string): Promise<Snapshot[]> {
    const base = this.snapshotsDir(projectId);
    let names: string[];
    try {
      names = await readdir(base);
    } catch {
      return [];
    }
    const found: Snapshot[] = [];
    for (const name of names) {
      const directory = join(base, name);
      try {
        found.push(snapshotFromJson(JSON.parse(await readFile(join(directory, SYNC_STATE.snapshotFile), "utf8")), directory));
      } catch {
        continue;
      }
    }
    return found.sort((a, b) => byCodePoint(b.createdAt, a.createdAt) || byCodePoint(b.id, a.id));
  }

  async newSnapshot(projectId: string, hostPath: string, entries: SnapshotEntry[], now = new Date()): Promise<Snapshot> {
    const base = this.snapshotsDir(projectId);
    await mkdir(base, { recursive: true, mode: DIR_MODE });
    const stem = snapshotStem(now);
    let id = stem;
    for (let n = 2; ; n += 1) {
      try {
        await mkdir(join(base, id), { mode: DIR_MODE });
        break;
      } catch (error) {
        if (errnoCode(error) !== "EEXIST") throw error;
        id = `${stem}-${n}`;
      }
    }
    return { id, projectId, hostPath, createdAt: iso(now), entries, kind: "pull", reverted: false, directory: join(base, id) };
  }

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    await writeAtomic(join(snapshot.directory, SYNC_STATE.snapshotFile), pythonJson(snapshotToJson(snapshot)), STATE_FILE_MODE);
    await fsyncDir(snapshot.directory);
  }

  async discardSnapshot(snapshot: Snapshot): Promise<void> {
    await rm(snapshot.directory, { recursive: true, force: true }).catch(() => undefined);
  }

  async prune(projectId: string, keep: number = SYNC_STATE.keepSnapshots): Promise<void> {
    for (const snapshot of (await this.snapshots(projectId)).slice(keep)) await this.discardSnapshot(snapshot);
  }
}
