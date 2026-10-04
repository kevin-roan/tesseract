import { LIMITS, PROJECT_ID_MAX_LENGTH, projectIdFromName } from "@theone/protocol";

import { PROJECTS_ROOT } from "@/features/sandbox/utils/constants";

const WORDS = 6;
const FALLBACK = "chat";

/** A folder-friendly project name from the first words of a prompt, e.g. "where-is-it-running". */
export function projectNameFromPrompt(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, WORDS).join(" ");
  return projectIdFromName(words) ?? FALLBACK;
}

/** Why `name` cannot become a new project folder, or null when it can. */
export function projectNameError(name: string, existingIds: readonly string[] = []): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a project name.";
  if (trimmed.length > LIMITS.maxNameLength) return `Keep the name under ${LIMITS.maxNameLength} characters.`;
  const projectId = projectIdFromName(trimmed);
  if (!projectId) return "Use at least one letter or digit.";
  if (existingIds.includes(projectId)) return `${PROJECTS_ROOT}/${projectId} already exists.`;
  return null;
}

/** `base`, then `base-2`, `base-3`… trimmed so the suffix always fits. */
export function projectNameCandidate(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  return `${base.slice(0, PROJECT_ID_MAX_LENGTH - suffix.length).replace(/[._-]+$/, "")}${suffix}`;
}

/** The prompt's project name, numbered past any folder that already exists. */
export function freeProjectName(prompt: string, existingIds: readonly string[] = []): string {
  const base = projectNameFromPrompt(prompt);
  for (let attempt = 1; ; attempt += 1) {
    const candidate = projectNameCandidate(base, attempt);
    if (!existingIds.includes(candidate)) return candidate;
  }
}
