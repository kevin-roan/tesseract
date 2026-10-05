import { useCallback, useMemo, useRef, useState } from "react";

import type { MenuOption } from "@/components/menu-sheet";

import { PROJECT_MENU_ACTIONS } from "../utils/actions";
import { PROJECT_REMOVAL_DETAIL } from "../utils/project-removal";
import { PROJECT_RENAME_DETAIL } from "../utils/project-rename";
import { useProjectRemoval, type ProjectTarget } from "./use-project-removal";
import { useProjectRename } from "./use-project-rename";

type Queued = { id: string; project: ProjectTarget };

/** A project card's overflow menu: rename, or delete from the sandbox. */
export function useProjectMenu() {
  const removal = useProjectRemoval();
  const rename = useProjectRename();
  const [target, setTarget] = useState<ProjectTarget | null>(null);
  const queued = useRef<Queued | null>(null);

  const options = useMemo<MenuOption[]>(
    () => [
      { ...PROJECT_MENU_ACTIONS.rename, description: PROJECT_RENAME_DETAIL },
      { ...PROJECT_MENU_ACTIONS.remove, description: PROJECT_REMOVAL_DETAIL, disabled: removal.busy },
    ],
    [removal.busy],
  );

  const select = useCallback(
    (id: string) => {
      if (!target || (id === PROJECT_MENU_ACTIONS.remove.id && removal.busy)) return;
      queued.current = { id, project: target };
      setTarget(null);
    },
    [removal.busy, target],
  );

  /** The next sheet or alert can only open once the menu is gone. */
  const onDismissed = useCallback(() => {
    const next = queued.current;
    queued.current = null;
    if (next?.id === PROJECT_MENU_ACTIONS.rename.id) rename.open(next.project);
    if (next?.id === PROJECT_MENU_ACTIONS.remove.id) void removal.ask(next.project);
  }, [rename, removal]);

  return {
    open: (project: ProjectTarget) => setTarget(project),
    menu: {
      visible: target !== null,
      title: target?.title ?? "",
      options,
      onSelect: select,
      onClose: () => setTarget(null),
      onDismissed,
    },
    renameSheet: rename.sheet,
    removeError: removal.error,
  };
}
