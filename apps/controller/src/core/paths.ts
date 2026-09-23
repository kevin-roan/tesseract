import { lstatSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep, isAbsolute } from "node:path";
import { normalizeProjectId } from "@theone/protocol";
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

export function requireProjectId(input: string): string {
  const id = normalizeProjectId(input);
  if (!id) throw badRequest(`Invalid project id "${input.slice(0, 80)}"`);
  return id;
}

export type ProjectLocation = { id: string; path: string; exists: boolean };

/**
 * Resolves `<projectsDir>/<id>`. Existing entries must be real directories
 * whose realpath stays under the projects root; symlinks leading elsewhere are refused.
 */
export function locateProject(projectsDir: string, input: string): ProjectLocation {
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
  if (!real || !isInside(root, real) || real === root) throw forbidden(`Project ${id} resolves outside the workspace`);
  const isDirectory = stats.isSymbolicLink() ? statSync(real).isDirectory() : stats.isDirectory();
  if (!isDirectory) throw badRequest(`Project ${id} is not a directory`);
  return { id, path: real, exists: true };
}
