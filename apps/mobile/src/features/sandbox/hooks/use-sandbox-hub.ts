import { useCallback, useMemo } from "react";
import type { ProcessInfo, TerminalInfo } from "@theone/protocol";

import type { ActionTileItem } from "@/components/action-tile-row";
import type { ChoiceOption } from "@/components/choice-group";
import type { HeaderAction } from "@/components/screen-header";
import type { StatItem } from "@/components/stat-grid";
import { latestTurns } from "@/features/chat/utils/messages";
import { confirm } from "@/lib/confirm";

import { useSandboxStore } from "../store/sandbox-store";
import type { HubActionId } from "../types";
import { HUB_HEADER_ACTIONS } from "../utils/actions";
import { newestFirst } from "../utils/collections";
import { LIST_PREVIEW_LIMIT } from "../utils/constants";
import { sandboxSubtitle } from "../utils/describe";
import { describeError } from "../utils/errors";
import { formatRelativeTime, formatUptime } from "../utils/format";
import { HUB_ACTIONS, ResourceIcons } from "../utils/icons";
import { buildShortcutProject, isActiveProcess } from "../utils/projects";
import { cpuGauge, storageGauge } from "../utils/resources";
import { useSandboxClient } from "./use-sandbox-client";
import { useSandboxLink } from "./use-sandbox-events";
import { useConfirmedStop } from "./use-confirmed-stop";
import { useCloseTerminal, useRemoveSandbox } from "./use-sandbox-mutations";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useProjectLabel } from "./use-project-names";
import { useSandboxProblems } from "./use-sandbox-problems";
import {
  useAgentRuns,
  useBuilds,
  useProcesses,
  useProjects,
  useSandboxActivity,
  useSandboxStatus,
  useTerminals,
} from "./use-sandbox-queries";
import { useSandboxRefresh } from "./use-sandbox-refresh";

export function useSandboxHub() {
  const nav = useSandboxNavigation();
  const { sandbox, hydrated } = useSandboxClient();
  const sandboxes = useSandboxStore((state) => state.sandboxes);
  const setActive = useSandboxStore((state) => state.setActive);
  const link = useSandboxLink();
  const status = useSandboxStatus();
  const projects = useProjects();
  const processes = useProcesses();
  const terminals = useTerminals();
  const builds = useBuilds();
  const runs = useAgentRuns();
  const projectName = useProjectLabel();
  const activity = useSandboxActivity();
  const stopProcess = useConfirmedStop();
  const closeTerminal = useCloseTerminal();
  const removeSandbox = useRemoveSandbox();
  const problems = useSandboxProblems(status.error);
  const { refreshing, refresh } = useSandboxRefresh();

  const actionError = stopProcess.error ?? closeTerminal.error;
  const buildProjectId = buildShortcutProject(builds.data, projects.data);

  const actions = useMemo<ActionTileItem[]>(() => {
    const handlers: Record<HubActionId, (() => void) | null> = {
      display: nav.display,
      terminal: () => nav.newTerminal({ kind: "shell" }),
      claude: () => nav.newAgentRun(),
      build: buildProjectId ? () => nav.project(buildProjectId) : null,
    };
    return HUB_ACTIONS.map(({ hint, unavailableHint, ...action }) => {
      const onPress = handlers[action.id];
      return onPress
        ? { ...action, onPress, accessibilityHint: hint }
        : { ...action, disabled: true, accessibilityHint: unavailableHint };
    });
  }, [nav, buildProjectId]);

  const stats = useMemo<StatItem[]>(() => {
    if (!status.data) return [];
    const { resources, display, uptimeSec, startedAt } = status.data;
    const cpu = cpuGauge(resources.cpu);
    const memory = storageGauge(resources.memory);
    const disk = storageGauge(resources.disk);
    return [
      { id: "cpu", icon: ResourceIcons.cpu, label: "CPU load", value: cpu.value, unit: cpu.unit, caption: cpu.caption, progress: cpu.fraction, tone: "violet" },
      { id: "memory", icon: ResourceIcons.memory, label: "Memory", value: memory.value, unit: memory.unit, caption: memory.caption, progress: memory.fraction, tone: "indigo" },
      { id: "disk", icon: ResourceIcons.disk, label: "Disk", value: disk.value, unit: disk.unit, caption: disk.caption, progress: disk.fraction },
      { id: "uptime", icon: ResourceIcons.uptime, label: "Uptime", value: formatUptime(uptimeSec), caption: `since ${formatRelativeTime(startedAt)}` },
      {
        id: "display",
        icon: ResourceIcons.display,
        label: "Display",
        value: display.available && display.width && display.height ? `${display.width}×${display.height}` : "Off",
        unit: display.vnc.available ? "VNC ready" : "VNC offline",
        onPress: nav.display,
      },
    ];
  }, [status.data, nav]);

  const switcher = useMemo<ChoiceOption[]>(
    () => sandboxes.map((entry) => ({ id: entry.id, label: entry.name })),
    [sandboxes],
  );

  const remove = useCallback(async () => {
    if (!sandbox) return;
    const confirmed = await confirm({
      title: `Remove ${sandbox.name}?`,
      message: "The token is deleted from this device. The sandbox keeps running; pair again to reconnect.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (confirmed) removeSandbox.mutate(sandbox.id);
  }, [sandbox, removeSandbox]);

  const headerActions = useMemo<HeaderAction[]>(
    () => [
      { ...HUB_HEADER_ACTIONS.pair, onPress: nav.pair },
      { ...HUB_HEADER_ACTIONS.remove, onPress: () => void remove(), disabled: removeSandbox.isPending },
    ],
    [nav, remove, removeSandbox.isPending],
  );

  const closeSession = useCallback(
    async (terminal: TerminalInfo) => {
      const confirmed = await confirm({
        title: "Close this session?",
        message: "Programs running in it are stopped.",
        confirmLabel: "Close",
        destructive: true,
      });
      if (confirmed) closeTerminal.mutate(terminal.id);
    },
    [closeTerminal],
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
    projectName,
    hydrated,
    sandbox,
    missingToken: problems.missingToken,
    link,
    subtitle: sandboxSubtitle(status.data),
    issue: problems.issue,
    repair: problems.repair,
    statusError: problems.error,
    retryStatus: () => void status.refetch(),
    stats,
    actions,
    switcher,
    selectSandbox: setActive,
    latestActivity: activity[0] ?? null,
    projects: projects.data ?? [],
    projectsLoading: projects.isLoading,
    addProject: nav.newProject,
    runningProcesses: (processes.data ?? []).filter(isActiveProcess),
    stoppingId: stopProcess.stoppingId,
    processPress,
    stopProcess: stopProcess.stop,
    sessions: (terminals.data ?? []).filter((terminal) => terminal.state === "running"),
    closingId: closeTerminal.isPending ? closeTerminal.variables : null,
    closeSession,
    recentBuilds: newestFirst(builds.data ?? [], (build) => build.createdAt, LIST_PREVIEW_LIMIT),
    buildsLoading: builds.isLoading,
    recentRuns: newestFirst(latestTurns(runs.data ?? []), (run) => run.startedAt, LIST_PREVIEW_LIMIT),
    runsLoading: runs.isLoading,
    refreshing,
    refresh,
    headerActions,
    removeError: removeSandbox.error ? describeError(removeSandbox.error) : null,
    actionError: actionError ? describeError(actionError) : null,
  };
}
