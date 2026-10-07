import { useCallback, useMemo } from "react";

import { useProjects } from "./use-sandbox-queries";

export function useProjectNames(): ReadonlyMap<string, string> {
  const projects = useProjects();
  return useMemo(() => new Map((projects.data ?? []).map((project) => [project.id, project.name])), [projects.data]);
}

/** The project's display name (renamed in the app), falling back to its id. */
export function useProjectLabel(): (projectId: string | null) => string | null {
  const names = useProjectNames();
  return useCallback((projectId) => (projectId ? (names.get(projectId) ?? projectId) : null), [names]);
}
