import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ProcessInfo, TerminalInfo } from "@theone/protocol";

import type { ActionTileItem } from "@/components/action-tile-row";
import type { ChoiceOption } from "@/components/choice-group";
import type { HeaderAction } from "@/components/screen-header";
import type { StatItem } from "@/components/stat-grid";
import { confirm } from "@/lib/confirm";

import { sandboxKeys } from "../api/query-keys";
import { useSandboxStore } from "../store/sandbox-store";
import type { HubActionId } from "../types";
import { HUB_HEADER_ACTIONS } from "../utils/actions";
import { newestFirst } from "../utils/collections";
import { LIST_PREVIEW_LIMIT } from "../utils/constants";
import { sandboxSubtitle } from "../utils/describe";
import { describeError, issueForError } from "../utils/errors";
import { HUB_ACTIONS, ResourceIcons } from "../utils/icons";
import { buildShortcutProject, isActiveProcess } from "../utils/projects";
import { cpuGauge, storageGauge } from "../utils/resources";
import { issueNotice } from "../utils/states";
import { useSandboxClient } from "./use-sandbox-client";
import { useSandboxIssue, useSandboxLink } from "./use-sandbox-events";
import { useCloseTerminal, useRemoveSandbox, useStopProcess } from "./use-sandbox-mutations";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import {
  useAgentRuns,
  useBuilds,
  useProcesses,
  useProjects,
  useSandboxActivity,
  useSandboxStatus,
  useTerminals,
} from "./use-sandbox-queries";

export function useSandboxHub() {
  const nav = useSandboxNavigation();
  const queryClient = useQueryClient();
  const { sandbox, hydrated, missingToken } = useSandboxClient();
  const sandboxes = useSandboxStore((state) => state.sandboxes);
  const setActive = useSandboxStore((state) => state.setActive);
  const link = useSandboxLink();
  const linkIssue = useSandboxIssue();
  const status = useSandboxStatus();
  const projects = useProjects();
  const processes = useProcesses();
  const terminals = useTerminals();
  const builds = useBuilds();
  const runs = useAgentRuns();
  const activity = useSandboxActivity();
  const stopProcess = useStopProcess();
  const closeTerminal = useCloseTerminal();
  const removeSandbox = useRemoveSandbox();
  const [refreshing, setRefreshing] = useState(false);

  const issue = linkIssue ?? issueForError(status.error);
  const repair = useCallback(() => {
    if (sandbox) nav.repair({ url: sandbox.baseUrl, name: sandbox.name });
  }, [nav, sandbox]);

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
    const { resources, display } = status.data;
    const cpu = cpuGauge(resources.cpu);
    const memory = storageGauge(resources.memory);
    const disk = storageGauge(resources.disk);
    return [
      { id: "cpu", icon: ResourceIcons.cpu, label: "CPU load", value: cpu.value, unit: cpu.unit, progress: cpu.fraction },
      { id: "memory", icon: ResourceIcons.memory, label: "Memory", value: memory.value, unit: memory.unit, progress: memory.fraction },
      { id: "disk", icon: ResourceIcons.disk, label: "Workspace disk", value: disk.value, unit: disk.unit, progress: disk.fraction },
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

  const refresh = useCallback(async () => {
    if (!sandbox) return;
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({
        queryKey: sandboxKeys.all(sandbox.id),
        type: "active",
        predicate: (query) => query.queryKey[2] !== "page" && query.queryKey[2] !== "activity",
      });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, sandbox]);

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
    hydrated,
    sandbox,
    missingToken,
    link,
    subtitle: sandboxSubtitle(status.data),
    issue: issue ? issueNotice(issue) : null,
    repair,
    statusError: status.error && !issue ? describeError(status.error) : null,
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
    stoppingId: stopProcess.isPending ? stopProcess.variables : null,
    processPress,
    stopProcess: (id: string) => stopProcess.mutate(id),
    sessions: (terminals.data ?? []).filter((terminal) => terminal.state === "running"),
    closingId: closeTerminal.isPending ? closeTerminal.variables : null,
    closeSession,
    recentBuilds: newestFirst(builds.data ?? [], (build) => build.createdAt, LIST_PREVIEW_LIMIT),
    recentRuns: newestFirst(runs.data ?? [], (run) => run.startedAt, LIST_PREVIEW_LIMIT),
    refreshing,
    refresh: () => void refresh(),
    headerActions,
    removeError: removeSandbox.error ? describeError(removeSandbox.error) : null,
  };
}
