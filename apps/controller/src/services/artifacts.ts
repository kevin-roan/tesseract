import { constants as fsConstants, existsSync, statSync } from "node:fs";
import { copyFile, link, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { createId, type Artifact, type ArtifactSource, type BuildProfile, type ShareArtifact } from "@theone/protocol";
import { badRequest, forbidden, notFound } from "../core/errors";
import { isInside, locateProject, realpathOrNull } from "../core/paths";
import { nowIso } from "../core/time";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";
import type { Config } from "../config";
import type { InboxService } from "./inbox";
import { projectForCwd } from "./ports";

export type ArtifactMeta = {
  projectId: string;
  buildId: string | null;
  platform: string;
  profile: BuildProfile;
  version: string;
};

type StoredMeta = {
  projectId: string;
  buildId: string | null;
  platform: string;
  source: ArtifactSource;
  agentRunId: string | null;
  note: string | null;
};

const EXTENSION_PATTERN = /(\.tar\.(?:gz|xz|bz2|zst)|\.[A-Za-z0-9]+)$/;
const MAX_NAME_ATTEMPTS = 1_000;

export function artifactExtension(fileName: string): string {
  return EXTENSION_PATTERN.exec(fileName)?.[1] ?? "";
}

export function sanitizeVersion(version: string | undefined): string {
  const cleaned = (version ?? "").trim().replace(/[^\w.+-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "0.0.0";
}

/** `<project>-<platform>-<profile>-<version>.<ext>`, with `-2`, `-3`… appended before the extension on collisions. */
export function artifactFileName(meta: ArtifactMeta, extension: string, attempt: number): string {
  const stem = `${meta.projectId}-${meta.platform}-${meta.profile}-${sanitizeVersion(meta.version)}`;
  return `${stem}${attempt > 1 ? `-${attempt}` : ""}${extension}`;
}

const PLATFORM_EXTENSIONS: Record<string, string> = {
  ".apk": "android",
  ".aab": "android",
  ".exe": "windows",
  ".msi": "windows",
  ".deb": "linux",
  ".rpm": "linux",
  ".appimage": "linux",
};

export function sharedPlatform(fileName: string): string {
  return PLATFORM_EXTENSIONS[artifactExtension(fileName).toLowerCase()] ?? "file";
}

/** `<stem><ext>`, then `<stem>-2<ext>`, `<stem>-3<ext>`… on collisions. */
export function sharedFileName(fileName: string, attempt: number): string {
  const extension = artifactExtension(fileName);
  const stem = fileName.slice(0, fileName.length - extension.length) || fileName;
  return `${stem}${attempt > 1 ? `-${attempt}` : ""}${stem === fileName ? "" : extension}`;
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`;
}

/**
 * Never overwrites `destination` (EEXIST instead). Moves use a hard link so they stay
 * exclusive, and fall back to a copy when the source is on another filesystem.
 */
async function placeExclusive(source: string, destination: string, move: boolean): Promise<void> {
  if (move) {
    try {
      await link(source, destination);
      await rm(source, { force: true });
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw error;
    }
  }
  await copyFile(source, destination, fsConstants.COPYFILE_EXCL);
  if (move) await rm(source, { force: true });
}

export async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk);
  return hasher.digest("hex");
}

export class ArtifactService {
  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
    private readonly hub: EventHub,
    private readonly inbox: InboxService,
    private readonly logger: Logger,
  ) {}

  list(projectId?: string): Artifact[] {
    return this.repos.artifacts.list({ projectId });
  }

  get(id: string): Artifact {
    const artifact = this.repos.artifacts.get(id);
    if (!artifact) throw notFound(`Artifact ${id} not found`);
    return artifact;
  }

  forBuild(buildId: string): Artifact[] {
    return this.repos.artifactsForBuild(buildId);
  }

  store(source: string, meta: ArtifactMeta, options: { move?: boolean } = {}): Promise<Artifact> {
    const extension = artifactExtension(basename(source));
    return this.place(source, (attempt) => artifactFileName(meta, extension, attempt), options.move === true, {
      projectId: meta.projectId,
      buildId: meta.buildId,
      platform: meta.platform,
      source: "build",
      agentRunId: null,
      note: null,
    });
  }

  /**
   * Copies a workspace file into the artifacts directory and announces it with a `file` inbox item.
   * Symlinks are resolved first; the artifacts and controller data directories are off limits.
   * An `agentRunId` that names no known run is dropped.
   */
  async share(input: ShareArtifact): Promise<Artifact> {
    const source = this.shareableFile(input.path);
    const projectId = this.shareProject(input.projectId, source);
    const fileName = input.name ?? basename(source);
    if (fileName === "." || fileName === "..") throw badRequest(`Invalid file name "${fileName}"`);
    const note = input.note?.trim() || null;
    const artifact = await this.place(source, (attempt) => sharedFileName(fileName, attempt), false, {
      projectId,
      buildId: null,
      platform: sharedPlatform(fileName),
      source: "agent",
      agentRunId: input.agentRunId && this.repos.agentRuns.get(input.agentRunId) ? input.agentRunId : null,
      note,
    });
    this.inbox.add({
      kind: "file",
      title: `New file: ${artifact.fileName}`,
      body: note ?? `${formatBytes(artifact.sizeBytes)} · ${projectId}`,
      projectId,
      sessionId: input.sessionId?.trim() || null,
      agentRunId: artifact.agentRunId,
      artifactId: artifact.id,
    });
    return artifact;
  }

  /** Removes the row and its file; inbox items that announced it keep their text with `artifactId` cleared. */
  async delete(id: string): Promise<Artifact> {
    const artifact = this.repos.deleteArtifact(id);
    if (!artifact) throw notFound(`Artifact ${id} not found`);
    const root = realpathOrNull(this.config.artifactsDir);
    if (root !== null && realpathOrNull(dirname(artifact.path)) === root) {
      await rm(artifact.path, { force: true }).catch((error: unknown) => this.logger.warn("could not remove artifact file", { path: artifact.path, error }));
    }
    this.hub.publish({ type: "artifact.deleted", id: artifact.id });
    this.logger.info("artifact deleted", { id: artifact.id, file: artifact.fileName });
    return artifact;
  }

  /** Refuses rows whose file was removed or no longer resolves inside the artifacts directory. */
  download(id: string): { artifact: Artifact; path: string } {
    const artifact = this.get(id);
    const root = realpathOrNull(this.config.artifactsDir);
    const real = realpathOrNull(artifact.path);
    if (!root || !real || !isInside(root, real) || !statSync(real).isFile()) {
      throw notFound(`Artifact file ${artifact.fileName} is no longer available`);
    }
    return { artifact, path: real };
  }

  private shareableFile(path: string): string {
    const real = realpathOrNull(path);
    if (!real) throw notFound(`File ${path} not found`);
    const workspace = realpathOrNull(this.config.workspace) ?? this.config.workspace;
    if (!isInside(workspace, real)) throw forbidden(`${path} is outside the workspace ${this.config.workspace}`);
    for (const dir of [this.config.artifactsDir, this.config.dataDir]) {
      const blocked = realpathOrNull(dir) ?? dir;
      if (isInside(blocked, real)) throw forbidden(`${path} is inside ${dir} and cannot be shared`);
    }
    if (!statSync(real).isFile()) throw badRequest(`${path} is not a regular file`);
    return real;
  }

  private shareProject(explicit: string | undefined, source: string): string {
    if (explicit !== undefined) {
      const project = locateProject(this.config.projectsDir, explicit);
      if (!project.exists) throw notFound(`Project ${project.id} not found`);
      return project.id;
    }
    const projectsDir = realpathOrNull(this.config.projectsDir) ?? this.config.projectsDir;
    const derived = projectForCwd(projectsDir, source);
    if (derived === null || source === join(projectsDir, derived)) throw badRequest("Pass a project id (--project) or share a file inside a project");
    return derived;
  }

  private async place(source: string, nameFor: (attempt: number) => string, move: boolean, meta: StoredMeta): Promise<Artifact> {
    let destination: string | null = null;
    for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS && destination === null; attempt += 1) {
      const candidate = join(this.config.artifactsDir, nameFor(attempt));
      if (existsSync(candidate)) continue;
      try {
        await placeExclusive(source, candidate, move);
        destination = candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    if (destination === null) throw new Error(`No free artifact name for ${nameFor(1)}`);
    const [info, sha256] = await Promise.all([stat(destination), sha256File(destination)]);
    const artifact: Artifact = {
      id: createId("artifact"),
      ...meta,
      fileName: basename(destination),
      path: destination,
      sizeBytes: info.size,
      sha256,
      createdAt: nowIso(),
    };
    this.repos.artifacts.save(artifact);
    this.hub.publish({ type: "artifact.created", artifact });
    this.logger.info("artifact stored", { id: artifact.id, file: artifact.fileName, bytes: artifact.sizeBytes, source: artifact.source });
    return artifact;
  }
}
