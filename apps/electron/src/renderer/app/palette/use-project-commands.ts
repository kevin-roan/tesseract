import { useMemo } from "react";
import { useApiQuery } from "../data";
import { useNavigateTo } from "../navigation";
import { PALETTE_PROJECTS_KEY } from "./constants";
import { PALETTE_LABELS as L } from "./labels";
import type { PaletteCommand } from "./types";

export function useProjectCommands(enabled: boolean): PaletteCommand[] {
  const navigateTo = useNavigateTo();
  const query = useApiQuery(PALETTE_PROJECTS_KEY, (client, signal) => client.listProjects({ signal }), { enabled });
  const projects = query.data;
  return useMemo(
    () =>
      (projects ?? []).map((project) => ({
        id: `project:${project.id}`,
        title: L.openProject(project.name),
        group: L.groups.projects,
        icon: project.confidential ? ("confidential" as const) : ("project" as const),
        subtitle: project.confidential ? L.confidential : project.framework,
        keywords: [project.name, project.id, project.framework],
        run: () => navigateTo("projects", { projectId: project.id }, project.id),
      })),
    [navigateTo, projects],
  );
}
