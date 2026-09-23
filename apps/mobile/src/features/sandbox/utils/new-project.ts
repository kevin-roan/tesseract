import {
  GIT_REF_PATTERN,
  GIT_URL_PATTERN,
  LIMITS,
  projectIdFromName,
  type CreateProject,
} from "@theone/protocol";

import type { Tone } from "@/lib/tone";

import type { ProjectDraft, ProjectDraftErrors } from "../types";
import { MAX_GIT_URL_LENGTH, PROJECTS_ROOT } from "./constants";

export const EMPTY_PROJECT_DRAFT: ProjectDraft = { name: "", gitUrl: "", branch: "" };

export type ProjectDraftValidation =
  | { ok: true; projectId: string; value: CreateProject }
  | { ok: false; errors: ProjectDraftErrors };

function nameError(name: string, projectId: string | null, existingIds: readonly string[]): string | undefined {
  if (!name) return "Enter a project name.";
  if (name.length > LIMITS.maxNameLength) return `Keep the name under ${LIMITS.maxNameLength} characters.`;
  if (!projectId) return "Use at least one letter or digit.";
  if (existingIds.includes(projectId)) return `${PROJECTS_ROOT}/${projectId} already exists.`;
  return undefined;
}

function gitUrlError(gitUrl: string): string | undefined {
  if (!gitUrl) return undefined;
  if (gitUrl.length > MAX_GIT_URL_LENGTH || !GIT_URL_PATTERN.test(gitUrl)) {
    return "Use an https://, ssh://, git:// or user@host:path URL.";
  }
  return undefined;
}

function branchError(branch: string, gitUrl: string): string | undefined {
  if (!branch) return undefined;
  if (!gitUrl) return "A branch only applies when cloning. Add a git URL or clear it.";
  if (!GIT_REF_PATTERN.test(branch)) return "That is not a valid branch name.";
  return undefined;
}

export function validateProjectDraft(draft: ProjectDraft, existingIds: readonly string[] = []): ProjectDraftValidation {
  const name = draft.name.trim();
  const gitUrl = draft.gitUrl.trim();
  const branch = draft.branch.trim();
  const projectId = projectIdFromName(name);
  const candidates: ProjectDraftErrors = {
    name: nameError(name, projectId, existingIds),
    gitUrl: gitUrlError(gitUrl),
    branch: branchError(branch, gitUrl),
  };
  const errors = Object.fromEntries(Object.entries(candidates).filter(([, message]) => message)) as ProjectDraftErrors;

  if (!projectId || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    projectId,
    value: { name, ...(gitUrl ? { gitUrl } : {}), ...(gitUrl && branch ? { branch } : {}) },
  };
}

export function projectLocationHint(name: string): string {
  const projectId = projectIdFromName(name);
  return projectId ? `Created as ${PROJECTS_ROOT}/${projectId}` : `Becomes a folder in ${PROJECTS_ROOT}.`;
}

export const createProjectLabel = (draft: ProjectDraft): string =>
  draft.gitUrl.trim() ? "Clone project" : "Create project";

export function cloneBadge(exitCode: number | null | undefined): { label: string; tone: Tone } {
  if (exitCode === undefined) return { label: "Cloning", tone: "info" };
  return exitCode === 0 ? { label: "Cloned", tone: "success" } : { label: "Failed", tone: "danger" };
}

export function cloneFailureMessage(exitCode: number | null): string {
  const reason = exitCode === null ? "git stopped before it finished." : `git exited with code ${exitCode}.`;
  return `${reason} The project folder stays in place, so you can open it and retry from a shell.`;
}
