import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { BuildOutput } from "@theone/protocol";
import { badRequest, notFound } from "../core/errors";
import { isInside, realpathOrNull } from "../core/paths";
import { artifactExtension, sharedPlatform } from "./artifacts";
import type { ProjectService } from "./projects";

/** Folder names build tools write deliverables under: Gradle `build/outputs`, electron-builder `dist`/`release`, Forge `out/make`. */
const OUTPUT_DIRS = new Set(["build", "builds", "dist", "release", "releases", "out", "outputs", "make", "artifacts"]);
const SKIPPED_DIRS = new Set(["node_modules", "intermediates", "generated", "tmp", "Pods", "DerivedData", "__pycache__", "venv", "coverage"]);
const UNPACKED_DIR = /-unpacked$|\.app$/;
const DELIVERABLES = new Set([
  ".apk",
  ".aab",
  ".ipa",
  ".exe",
  ".msi",
  ".msix",
  ".appx",
  ".appimage",
  ".deb",
  ".rpm",
  ".snap",
  ".dmg",
  ".pkg",
  ".zip",
  ".7z",
  ".tar.gz",
  ".tar.xz",
  ".tar.bz2",
  ".tar.zst",
]);
const HELPER_FILE = /^__uninstaller|^elevate\.exe$/i;
const MAX_DEPTH = 10;
const MAX_ENTRIES_PER_PROJECT = 20_000;
const MAX_OUTPUTS = 500;

/** `relativePath` uses `/`; true when it names a deliverable inside a build output folder of the project. */
export function isBuildOutputPath(relativePath: string): boolean {
  const parts = relativePath.split("/");
  const fileName = parts.pop() ?? "";
  if (!fileName || HELPER_FILE.test(fileName)) return false;
  if (!DELIVERABLES.has(artifactExtension(fileName).toLowerCase())) return false;
  if (parts.some((part) => !part || part === ".." || part.startsWith(".") || SKIPPED_DIRS.has(part) || UNPACKED_DIR.test(part))) return false;
  return parts.some((part) => OUTPUT_DIRS.has(part));
}

function descend(name: string): boolean {
  return !name.startsWith(".") && !SKIPPED_DIRS.has(name) && !UNPACKED_DIR.test(name);
}

/** Lists deliverables builds left in project folders, so plain `gradlew`/`electron-builder` runs show up without `share`. */
export class BuildOutputService {
  constructor(private readonly projects: ProjectService) {}

  async list(projectId?: string): Promise<BuildOutput[]> {
    const ids = projectId === undefined ? this.projects.ids() : [this.projects.require(projectId).id];
    const found = (await Promise.all(ids.map((id) => this.scan(id)))).flat();
    return found.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, MAX_OUTPUTS);
  }

  /** Resolves `path` (relative to the project) to a real file that still passes the build-output rules. */
  async resolve(projectId: string, path: string): Promise<{ output: BuildOutput; path: string }> {
    const project = this.projects.require(projectId);
    const real = realpathOrNull(join(project.path, path));
    const rel = real ? relative(project.path, real).split(sep).join("/") : "";
    if (!real || !isInside(project.path, real) || !isBuildOutputPath(rel)) throw notFound(`Build output ${path} not found`);
    const info = await stat(real);
    if (!info.isFile()) throw badRequest(`${path} is not a regular file`);
    return { output: this.describe(project.id, rel, info.size, info.mtime), path: real };
  }

  private async scan(projectId: string): Promise<BuildOutput[]> {
    const root = this.projects.require(projectId).path;
    const outputs: BuildOutput[] = [];
    const queue: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
    let visited = 0;
    while (queue.length > 0 && visited < MAX_ENTRIES_PER_PROJECT) {
      const { dir, depth } = queue.shift()!;
      let entries: Dirent[];
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      visited += entries.length;
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (depth < MAX_DEPTH && descend(entry.name)) queue.push({ dir: full, depth: depth + 1 });
          continue;
        }
        if (!entry.isFile()) continue;
        const rel = relative(root, full).split(sep).join("/");
        if (!isBuildOutputPath(rel)) continue;
        try {
          const info = await stat(full);
          outputs.push(this.describe(projectId, rel, info.size, info.mtime));
        } catch {
          // Removed between readdir and stat.
        }
      }
    }
    return outputs;
  }

  private describe(projectId: string, path: string, sizeBytes: number, modified: Date): BuildOutput {
    const fileName = path.slice(path.lastIndexOf("/") + 1);
    return { projectId, path, fileName, sizeBytes, platform: sharedPlatform(fileName), modifiedAt: modified.toISOString() };
  }
}
