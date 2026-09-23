import { useCallback, useMemo } from "react";
import type { AgentRun } from "@theone/protocol";

import type { ChoiceOption } from "@/components/choice-group";

import { frameworkIcon } from "../utils/icons";
import { useAgentComposer } from "./use-agent-composer";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useProjects } from "./use-sandbox-queries";

export function useNewAgentRun(projectId: string | null) {
  const nav = useSandboxNavigation();
  const projects = useProjects();
  const onStarted = useCallback((run: AgentRun) => nav.replaceWithAgentRun(run.id), [nav]);
  const composer = useAgentComposer({ defaultProjectId: projectId, onStarted });

  const projectOptions = useMemo<ChoiceOption[]>(
    () =>
      (projects.data ?? []).map((project) => ({
        id: project.id,
        label: project.name,
        icon: frameworkIcon(project.framework),
      })),
    [projects.data],
  );

  return { nav, composer, projectOptions };
}
