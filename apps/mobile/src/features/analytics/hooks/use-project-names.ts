import { useMemo } from "react";

import { useProjects } from "@/features/sandbox/hooks/use-sandbox-queries";

export function useProjectNames(): ReadonlyMap<string, string> {
  const projects = useProjects();
  return useMemo(() => new Map((projects.data ?? []).map((project) => [project.id, project.name])), [projects.data]);
}
