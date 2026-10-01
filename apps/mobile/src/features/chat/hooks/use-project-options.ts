import { useMemo } from "react";

import type { ChoiceOption } from "@/components/choice-group";
import { useProjects } from "@/features/sandbox/hooks/use-sandbox-queries";
import { frameworkIcon } from "@/features/sandbox/utils/icons";

export function useProjectOptions(): ChoiceOption[] {
  const projects = useProjects();
  return useMemo(
    () =>
      (projects.data ?? []).map((project) => ({
        id: project.id,
        label: project.name,
        icon: frameworkIcon(project.framework),
      })),
    [projects.data],
  );
}
