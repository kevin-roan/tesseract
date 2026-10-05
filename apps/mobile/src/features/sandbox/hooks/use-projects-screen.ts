import { useCallback, useMemo } from "react";
import type { ListeningPort, ProcessInfo } from "@theone/protocol";

import type { HeaderAction } from "@/components/screen-header";

import { PROJECTS_HEADER_ACTIONS } from "../utils/actions";
import { describeError } from "../utils/errors";
import { activeWork, activeWorkCount, projectCardModels } from "../utils/overview";
import { sortSites } from "../utils/sites";
import { useConfirmedStop } from "./use-confirmed-stop";
import { useSandboxClient } from "./use-sandbox-client";
import { useSandboxLink } from "./use-sandbox-events";
import { useOpenSite } from "./use-open-site";
import { useProjectMenu } from "./use-project-menu";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useSandboxProblems } from "./use-sandbox-problems";
import { useAgentRuns, useBuilds, useListeningPorts, useProcesses, useProjects } from "./use-sandbox-queries";
import { useSandboxRefresh } from "./use-sandbox-refresh";

export function useProjectsScreen() {
  const nav = useSandboxNavigation();
  const { sandbox, hydrated } = useSandboxClient();
  const link = useSandboxLink();
  const projects = useProjects();
  const processes = useProcesses();
  const builds = useBuilds();
  const runs = useAgentRuns();
  const ports = useListeningPorts();
  const openSite = useOpenSite();
  const stopProcess = useConfirmedStop();
  const projectMenu = useProjectMenu();
  const problems = useSandboxProblems(projects.error);
  const { refreshing, refresh } = useSandboxRefresh();

  const running = useMemo(
    () => activeWork({ processes: processes.data, builds: builds.data, runs: runs.data }),
    [processes.data, builds.data, runs.data],
  );

  const cards = useMemo(
    () => projectCardModels(projects.data ?? [], running, { builds: builds.data, runs: runs.data }),
    [projects.data, running, builds.data, runs.data],
  );

  const sites = useMemo(() => sortSites(ports.data?.ports), [ports.data]);

  const sitePress = useCallback(
    (site: ListeningPort) => {
      const { projectId, processId } = site;
      return projectId ? () => nav.project(projectId, processId ?? undefined) : undefined;
    },
    [nav],
  );

  const headerActions = useMemo<HeaderAction[]>(
    () => [
      { ...PROJECTS_HEADER_ACTIONS.add, onPress: nav.newProject },
      { ...PROJECTS_HEADER_ACTIONS.files, onPress: () => nav.files() },
      { ...PROJECTS_HEADER_ACTIONS.hub, onPress: nav.sandboxHub },
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
    projectsError: problems.error,
    retryProjects: () => void projects.refetch(),
    projects: cards,
    projectsLoading: projects.isLoading,
    addProject: nav.newProject,
    openProject: (id: string) => nav.project(id),
    askClaude: (id: string) => nav.newAgentRun(id),
    projectMenu: projectMenu.open,
    projectMenuSheet: projectMenu.menu,
    renameSheet: projectMenu.renameSheet,
    removeError: projectMenu.removeError,
    running,
    runningCount: activeWorkCount(running),
    processPress,
    sites,
    sitePress,
    openSite: openSite.open,
    siteError: openSite.error,
    stopProcess: stopProcess.stop,
    stoppingId: stopProcess.stoppingId,
    stopError: stopProcess.error ? describeError(stopProcess.error) : null,
    refreshing,
    refresh,
  };
}
