import { PROJECT_ID_MAX_LENGTH, projectIdFromName } from "@theone/protocol";

const WORDS = 6;
const FALLBACK = "chat";

/** A folder-friendly project name from the first words of a prompt, e.g. "where-is-it-running". */
export function projectNameFromPrompt(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, WORDS).join(" ");
  return projectIdFromName(words) ?? FALLBACK;
}

/** `base`, then `base-2`, `base-3`… trimmed so the suffix always fits. */
export function projectNameCandidate(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  return `${base.slice(0, PROJECT_ID_MAX_LENGTH - suffix.length).replace(/[._-]+$/, "")}${suffix}`;
}
