import type { ProjectDirectory, ProjectFile } from "@tesseract/protocol";
import { useCallback, useEffect, useMemo, useState } from "react";
import { describeError } from "../../../../../app/connection";
import { useApiClient } from "../../../../../app/data";
import { useProjectFileActions } from "../../../../../features/files/hooks/use-project-file-actions";
import type { TabHost } from "../../../../../features/projects/hooks/use-tab-host";
import { isFolder, parentPath, pathCrumbs, ROOT_PATH } from "../model";

export interface FilesTabInput {
  projectId: string;
  rootLabel: string;
  host: TabHost;
}

export function useFilesTab({ projectId, rootLabel, host }: FilesTabInput) {
  const client = useApiClient();
  const { report } = host;
  const [path, setPath] = useState(ROOT_PATH);
  const [directory, setDirectory] = useState<ProjectDirectory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => setPath(ROOT_PATH), [projectId]);

  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    setError(null);
    client.listProjectFiles(projectId, path, { signal: controller.signal }).then(
      (next) => setDirectory(next),
      (failure: unknown) => {
        if (controller.signal.aborted) return;
        setDirectory(null);
        setError(describeError(failure));
      },
    );
    return () => controller.abort();
  }, [client, projectId, path, revision]);

  const fail = useCallback((message: string) => report(new Error(message)), [report]);
  const actions = useProjectFileActions(projectId, fail);
  const current = directory?.projectId === projectId && directory.path === path ? directory : null;

  const open = useCallback((file: ProjectFile) => {
    if (isFolder(file)) setPath(file.path);
  }, []);

  return useMemo(
    () => ({
      path,
      directory: current,
      loading: current === null && error === null,
      error,
      crumbs: pathCrumbs(rootLabel, path),
      atRoot: path === ROOT_PATH,
      actions,
      open,
      navigate: setPath,
      up: () => setPath(parentPath(path)),
      refresh: () => setRevision((value) => value + 1),
    }),
    [path, current, error, rootLabel, actions, open],
  );
}
