import { useCallback, useState } from "react";

import { describeError } from "../utils/errors";
import { projectRenameError, projectRenameHint, projectRenameValue } from "../utils/project-rename";
import { useRenameProject } from "./use-sandbox-mutations";

type RenameTarget = { id: string; title: string };

/** A sheet that edits a project's display name; the id and folder never change. */
export function useProjectRename() {
  const rename = useRenameProject();
  const { mutate, reset } = rename;
  const [target, setTarget] = useState<RenameTarget | null>(null);
  const [name, setName] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  const open = useCallback(
    (project: RenameTarget) => {
      reset();
      setInvalid(null);
      setName(project.title);
      setTarget(project);
    },
    [reset],
  );

  const close = useCallback(() => setTarget(null), []);

  const change = useCallback(
    (text: string) => {
      setName(text);
      setInvalid(null);
      reset();
    },
    [reset],
  );

  const save = useCallback(() => {
    if (!target || rename.isPending) return;
    const error = projectRenameError(name);
    if (error) {
      setInvalid(error);
      return;
    }
    const next = projectRenameValue(name);
    if (next === target.title) {
      setTarget(null);
      return;
    }
    mutate({ id: target.id, name: next }, { onSuccess: () => setTarget(null) });
  }, [target, name, rename.isPending, mutate]);

  const error = invalid ?? (rename.error ? describeError(rename.error) : null);

  return {
    open,
    sheet: {
      visible: target !== null,
      name,
      setName: change,
      hint: target ? projectRenameHint(target.id) : "",
      error,
      saving: rename.isPending,
      save,
      close,
    },
  };
}

export type ProjectRenameSheetState = ReturnType<typeof useProjectRename>["sheet"];
