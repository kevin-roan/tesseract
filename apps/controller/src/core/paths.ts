import { existsSync, lstatSync, mkdirSync, realpathSync, renameSync, statSync } from "node:fs";
import { dirname, join, relative, sep, isAbsolute } from "node:path";
import { normalizeProjectId } from "@tesseract/protocol";
import { badRequest, forbidden } from "./errors";

export function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
}

export function realpathOrNull(path: string): string | null {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

/** Moves state left under a pre-rename (theone, Monolith) path to `path` once; a no-op when `path` exists. */
export function adoptLegacyPath(legacy: string, path: string): boolean {
  if (existsSync(path) || !existsSync(legacy)) return false;
  mkdirSync(dirname(path), { recursive: true });
  renameSync(legacy, path);
  return true;
}

export function requireProjectId(input: string): string {
  const id = normalizeProjectId(input);
  if (!id) throw badRequest(`Invalid project id "${input.slice(0, 80)}"`);
  return id;
}

export type ProjectLocation = { id: string; path: string; exists: boolean };

/**
 * Resolves `<projectsDir>/<id>`. Existing entries must be real directories
 * whose realpath stays under the projects root; symlinks leading elsewhere are refused
 * unless `external` (the host runtime, whose projects link to host repositories).
 */
export function locateProject(projectsDir: string, input: string, external = false): ProjectLocation {
  const id = requireProjectId(input);
  const path = join(projectsDir, id);
  let stats;
  try {
    stats = lstatSync(path);
  } catch {
    return { id, path, exists: false };
  }
  const root = realpathOrNull(projectsDir) ?? projectsDir;
  const real = realpathOrNull(path);
  if (!real || real === root || (!external && !isInside(root, real))) throw forbidden(`Project ${id} resolves outside the workspace`);
  const isDirectory = stats.isSymbolicLink() ? statSync(real).isDirectory() : stats.isDirectory();
  if (!isDirectory) throw badRequest(`Project ${id} is not a directory`);
  return { id, path: real, exists: true };
}

/** `locateProject` for a controller: the host runtime follows project links to host repositories. */
export function locateConfiguredProject(config: { projectsDir: string; runtime: string }, input: string): ProjectLocation {
  return locateProject(config.projectsDir, input, config.runtime === "host");
}
