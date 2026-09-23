import { constants as fsConstants, existsSync, statSync } from "node:fs";
import { copyFile, link, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { createId, type Artifact, type BuildProfile } from "@theone/protocol";
import { notFound } from "../core/errors";
import { isInside, realpathOrNull } from "../core/paths";
import { nowIso } from "../core/time";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";
import type { Config } from "../config";

export type ArtifactMeta = {
  projectId: string;
  buildId: string | null;
  platform: string;
  profile: BuildProfile;
  version: string;
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

  async store(source: string, meta: ArtifactMeta, options: { move?: boolean } = {}): Promise<Artifact> {
    const extension = artifactExtension(basename(source));
    let destination: string | null = null;
    for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS && destination === null; attempt += 1) {
      const candidate = join(this.config.artifactsDir, artifactFileName(meta, extension, attempt));
      if (existsSync(candidate)) continue;
      try {
        await placeExclusive(source, candidate, options.move === true);
        destination = candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    if (destination === null) throw new Error(`No free artifact name for ${artifactFileName(meta, extension, 1)}`);
    const [info, sha256] = await Promise.all([stat(destination), sha256File(destination)]);
    const artifact: Artifact = {
      id: createId("artifact"),
      projectId: meta.projectId,
      buildId: meta.buildId,
      fileName: basename(destination),
      path: destination,
      sizeBytes: info.size,
      sha256,
      platform: meta.platform,
      createdAt: nowIso(),
    };
    this.repos.artifacts.save(artifact);
    this.hub.publish({ type: "artifact.created", artifact });
    this.logger.info("artifact stored", { id: artifact.id, file: artifact.fileName, bytes: artifact.sizeBytes });
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
}
