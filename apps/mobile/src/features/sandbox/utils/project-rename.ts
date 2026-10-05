import { LIMITS } from "@theone/protocol";

export const PROJECT_RENAME_DETAIL = "Changes the name shown in the apps. The folder stays the same.";

export const projectRenameHint = (id: string) =>
  `The folder stays /workspace/projects/${id}. Leave it empty to use the detected name.`;

/** Blank restores the name the sandbox detects (package.json name or folder). */
export const projectRenameValue = (name: string): string | null => name.trim() || null;

export function projectRenameError(name: string): string | null {
  return name.trim().length > LIMITS.maxNameLength ? `Keep the name under ${LIMITS.maxNameLength} characters.` : null;
}
