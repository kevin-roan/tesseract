import { useCallback, useMemo, useRef, useState } from "react";

import type { MenuOption } from "@/components/menu-sheet";
import { confirm } from "@/lib/confirm";

import { PROJECT_MENU_ACTIONS } from "../utils/actions";
import { describeError } from "../utils/errors";
import { PROJECT_REMOVAL_DETAIL, projectRemovalPrompt } from "../utils/project-removal";
import { useSandboxClient } from "./use-sandbox-client";
import { useDeleteProject } from "./use-sandbox-mutations";

type RemovalTarget = { id: string; title: string };

/**
 * A project card's overflow menu with "Delete from sandbox": checks for changes not synced back
 * to the host first, and only force-deletes after the user saw them.
 */
export function useProjectRemoval() {
  const { client } = useSandboxClient();
  const deleteProject = useDeleteProject();
  const { mutate, reset } = deleteProject;
  const [target, setTarget] = useState<RemovalTarget | null>(null);
  const [checkError, setCheckError] = useState<unknown>(null);
  const [checking, setChecking] = useState(false);
  const queued = useRef<RemovalTarget | null>(null);

  const busy = checking || deleteProject.isPending;

  const options = useMemo<MenuOption[]>(
    () => [
      {
        id: PROJECT_MENU_ACTIONS.remove.id,
        label: PROJECT_MENU_ACTIONS.remove.label,
        icon: PROJECT_MENU_ACTIONS.remove.icon,
        description: PROJECT_REMOVAL_DETAIL,
        disabled: busy,
      },
    ],
    [busy],
  );

  const ask = useCallback(
    async (project: RemovalTarget) => {
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

  const select = useCallback(
    (id: string) => {
      if (id !== PROJECT_MENU_ACTIONS.remove.id || busy) return;
      queued.current = target;
      setTarget(null);
    },
    [busy, target],
  );

  /** The confirmation alert can only open once the sheet is gone. */
  const onDismissed = useCallback(() => {
    const project = queued.current;
    queued.current = null;
    if (project) void ask(project);
  }, [ask]);

  const error = deleteProject.error ?? checkError;

  return {
    open: (project: RemovalTarget) => setTarget(project),
    menu: {
      visible: target !== null,
      title: target?.title ?? "",
      options,
      onSelect: select,
      onClose: () => setTarget(null),
      onDismissed,
    },
    error: error ? describeError(error) : null,
  };
}
