import { useCallback, useMemo } from "react";
import type { ProcessInfo } from "@theone/protocol";

import type { HeaderAction } from "@/components/screen-header";

import { TASKS_HEADER_ACTIONS } from "../utils/actions";
import { LIST_PREVIEW_LIMIT } from "../utils/constants";
import { describeError } from "../utils/errors";
import { activeWork, activeWorkCount, finishedWork } from "../utils/overview";
import { useConfirmedStop } from "./use-confirmed-stop";
import { useSandboxClient } from "./use-sandbox-client";
import { useSandboxLink } from "./use-sandbox-events";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useProjectLabel } from "./use-project-names";
import { useSandboxProblems } from "./use-sandbox-problems";
import { useAgentRuns, useBuilds, useProcesses } from "./use-sandbox-queries";
import { useSandboxRefresh } from "./use-sandbox-refresh";

export function useTasksScreen() {
  const nav = useSandboxNavigation();
  const { sandbox, hydrated } = useSandboxClient();
  const link = useSandboxLink();
  const processes = useProcesses();
  const builds = useBuilds();
  const runs = useAgentRuns();
  const projectName = useProjectLabel();
  const stopProcess = useConfirmedStop();
  const problems = useSandboxProblems(processes.error ?? builds.error ?? runs.error);
  const { refreshing, refresh } = useSandboxRefresh();

  const sources = useMemo(
    () => ({ processes: processes.data, builds: builds.data, runs: runs.data }),
    [processes.data, builds.data, runs.data],
  );
  const running = useMemo(() => activeWork(sources), [sources]);
  const finished = useMemo(() => finishedWork(sources, LIST_PREVIEW_LIMIT), [sources]);

  const retry = useCallback(() => {
    void processes.refetch();
    void builds.refetch();
    void runs.refetch();
  }, [processes, builds, runs]);

  const headerActions = useMemo<HeaderAction[]>(
    () => [
      { ...TASKS_HEADER_ACTIONS.askClaude, onPress: () => nav.newAgentRun() },
      { ...TASKS_HEADER_ACTIONS.shell, onPress: () => nav.newTerminal({ kind: "shell" }) },
    ],
    [nav],
  );

  const processPress = useCallback(
    (process: ProcessInfo) => {
      const { projectId } = process;
      return projectId ? () => nav.project(projectId, process.id) : undefined;
    },
    [nav],
  );

  return {
    nav,
    hydrated,
    sandbox,
    link,
    headerActions,
    missingToken: problems.missingToken,
    issue: problems.issue,
    repair: problems.repair,
    error: problems.error,
    retry,
    loading: processes.isLoading || builds.isLoading || runs.isLoading,
    running,
    runningCount: activeWorkCount(running),
    finished,
    finishedCount: activeWorkCount(finished),
    processPress,
    projectName,
    stopProcess: stopProcess.stop,
    stoppingId: stopProcess.stoppingId,
    stopError: stopProcess.error ? describeError(stopProcess.error) : null,
    refreshing,
    refresh,
  };
}
