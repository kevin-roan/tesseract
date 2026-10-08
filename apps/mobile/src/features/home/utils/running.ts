import type { AgentRun } from "@tesseract/protocol";

import type { StatusBadgeProps } from "@/components/status-badge";
import { agentRunMeta } from "@/features/sandbox/utils/describe";
import { activeWork } from "@/features/sandbox/utils/overview";
import { agentRunTone, stateLabel } from "@/features/sandbox/utils/states";

export const HOME_RUNNING_LIMIT = 2;
export const TASKS_ROUTE = "/tasks";

export type RunningTask = {
  id: string;
  title: string;
  meta: string;
  badge: StatusBadgeProps;
};

/** The newest unfinished agent runs, at most `limit`, with how many are running in all. */
export function runningTasks(
  runs: readonly AgentRun[] | undefined,
  projectName: (projectId: string | null) => string | null,
  limit: number = HOME_RUNNING_LIMIT,
  now: number = Date.now(),
): { tasks: RunningTask[]; total: number } {
  const active = activeWork({ runs }).runs;
  return {
    tasks: active.slice(0, limit).map((run) => ({
      id: run.id,
      title: run.prompt,
      meta: agentRunMeta(run, projectName(run.projectId), now),
      badge: { label: stateLabel(run.state), tone: agentRunTone(run.state) },
    })),
    total: active.length,
  };
}
