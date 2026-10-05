import { useCallback, useState } from "react";

import { confirm } from "@/lib/confirm";

import { describeError } from "../utils/errors";
import { projectRemovalPrompt } from "../utils/project-removal";
import { useSandboxClient } from "./use-sandbox-client";
import { useDeleteProject } from "./use-sandbox-mutations";

export type ProjectTarget = { id: string; title: string };

/** "Delete from sandbox": checks for changes not synced back to the host first, and only force-deletes after the user saw them. */
export function useProjectRemoval() {
  const { client } = useSandboxClient();
  const deleteProject = useDeleteProject();
  const { mutate, reset } = deleteProject;
  const [checkError, setCheckError] = useState<unknown>(null);
  const [checking, setChecking] = useState(false);

  const ask = useCallback(
    async (project: ProjectTarget) => {
      if (!client) return;
      setCheckError(null);
      reset();
      setChecking(true);
      let prompt;
      try {
        prompt = projectRemovalPrompt(project.title, await client.syncChanges(project.id));
      } catch (error) {
        setCheckError(error);
        return;
      } finally {
        setChecking(false);
      }
      if (await confirm(prompt)) mutate({ id: project.id, force: prompt.force });
    },
    [client, mutate, reset],
  );

  const error = deleteProject.error ?? checkError;

  return {
    ask,
    busy: checking || deleteProject.isPending,
    error: error ? describeError(error) : null,
  };
}
