import { useCallback, useMemo } from "react";
import { router, type Href } from "expo-router";

import { useProjectLabel } from "@/features/sandbox/hooks/use-project-names";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useAgentRuns } from "@/features/sandbox/hooks/use-sandbox-queries";

import { runningTasks, TASKS_ROUTE } from "../utils/running";

export function useRunningTasks() {
  const nav = useSandboxNavigation();
  const runs = useAgentRuns();
  const projectName = useProjectLabel();
  const { tasks, total } = useMemo(() => runningTasks(runs.data, projectName), [runs.data, projectName]);
  const viewAll = useCallback(() => router.navigate(TASKS_ROUTE as Href), []);

  return { tasks, total, open: nav.agentRun, viewAll };
}
