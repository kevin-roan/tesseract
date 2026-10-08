import { useCallback, useEffect, useMemo, useState } from "react";
import { isFinalProcessState } from "@tesseract/protocol";

import type { CloneJob, ProjectDraft, ProjectDraftErrors, ProjectField } from "../types";
import { describeError } from "../utils/errors";
import {
  EMPTY_PROJECT_DRAFT,
  cloneBadge,
  cloneFailureMessage,
  createProjectLabel,
  projectLocationHint,
  validateProjectDraft,
} from "../utils/new-project";
import { useLogStream } from "./use-log-stream";
import { useCreateProject } from "./use-sandbox-mutations";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useProcesses, useProjects } from "./use-sandbox-queries";

type FormState = { draft: ProjectDraft; errors: ProjectDraftErrors };

/**
 * Creates a project; when the controller clones it, follows the clone's log
 * until git exits and then opens the project. The exit comes from the log
 * stream, or from the process list the events socket keeps current.
 */
export function useNewProject() {
  const nav = useSandboxNavigation();
  const projects = useProjects();
  const processes = useProcesses();
  const create = useCreateProject();
  const [form, setForm] = useState<FormState>({ draft: EMPTY_PROJECT_DRAFT, errors: {} });
  const [job, setJob] = useState<CloneJob | null>(null);
  const logs = useLogStream(job ? { kind: "process", id: job.processId } : null);
  const { mutate, reset, isPending, isError } = create;
  const { replaceWithProject } = nav;

  const existingIds = useMemo(() => (projects.data ?? []).map((project) => project.id), [projects.data]);

  const setField = useCallback(
    (field: ProjectField, value: string) => {
      if (isError) reset();
      setForm((current) => ({
        draft: { ...current.draft, [field]: value },
        errors: { ...current.errors, [field]: undefined },
      }));
    },
    [isError, reset],
  );

  const submit = useCallback(() => {
    if (isPending) return;
    const validation = validateProjectDraft(form.draft, existingIds);
    if (!validation.ok) {
      setForm((current) => ({ ...current, errors: validation.errors }));
      return;
    }
    reset();
    mutate(validation.value, {
      onSuccess: ({ project, processId }) => {
        if (processId) setJob({ projectId: project.id, processId, gitUrl: validation.value.gitUrl ?? "" });
        else replaceWithProject(project.id);
      },
    });
  }, [isPending, form.draft, existingIds, reset, mutate, replaceWithProject]);

  const process = job ? processes.data?.find((entry) => entry.id === job.processId) : undefined;
  const processExit = process && isFinalProcessState(process.state) ? process.exitCode : undefined;
  const exitCode = logs.exitCode !== undefined ? logs.exitCode : processExit;

  useEffect(() => {
    if (job && exitCode === 0) replaceWithProject(job.projectId);
  }, [job, exitCode, replaceWithProject]);

  const openProject = useCallback(() => {
    if (job) replaceWithProject(job.projectId);
  }, [job, replaceWithProject]);

  return {
    nav,
    form: {
      draft: form.draft,
      errors: form.errors,
      setField,
      submit,
      submitting: isPending,
      submitLabel: createProjectLabel(form.draft),
      locationHint: projectLocationHint(form.draft.name),
      error: create.error ? describeError(create.error) : null,
    },
    clone: job
      ? {
          ...job,
          lines: logs.lines,
          exitCode,
          badge: cloneBadge(exitCode),
          failure: exitCode !== undefined && exitCode !== 0 ? cloneFailureMessage(exitCode) : null,
          emptyLabel: logs.error ?? "Waiting for git…",
          openProject,
        }
      : null,
  };
}
