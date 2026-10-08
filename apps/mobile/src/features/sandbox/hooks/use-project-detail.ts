import { useCallback, useMemo, useState } from "react";
import type { BuildProfile, BuildTarget, ProcessInfo } from "@tesseract/protocol";

import type { HeaderAction } from "@/components/screen-header";
import { useAppRuns } from "@/features/app-runs/hooks/use-app-runs";
import { VIEWER_ICONS } from "@/features/app-runs/utils/content";
import { useProjectChats } from "@/features/chats/hooks/use-project-chats";
import { useProjectClaudeAccount } from "@/features/claude-account/hooks/use-project-claude-account";

import { PROJECT_ACTIONS } from "../utils/actions";
import { newestFirst } from "../utils/collections";
import { LIST_PREVIEW_LIMIT } from "../utils/constants";
import { describeError } from "../utils/errors";
import { buildTargetOptions, frameworkLabel } from "../utils/labels";
import { gitSummaryLabel, prefersDisplay, runScriptCommand, scriptCommand } from "../utils/projects";
import { processSite, projectSites } from "../utils/sites";
import { useArtifactDownload } from "./use-artifact-download";
import { useLogStream } from "./use-log-stream";
import { useOpenSite } from "./use-open-site";
import { useProjectRename } from "./use-project-rename";
import { useConfirmedStop } from "./use-confirmed-stop";
import { useFixWithAi } from "./use-fix-with-ai";
import { useStartBuild, useStartProcess } from "./use-sandbox-mutations";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useArtifacts, useBuilds, useListeningPorts, useProcesses, useProject, useProjectGit } from "./use-sandbox-queries";
import { useSandboxRefresh } from "./use-sandbox-refresh";
import { useScriptBookmarks } from "./use-script-bookmarks";
import { useSyncBack } from "./use-sync-back";

type LogsHost = "script" | "process" | "app";

export function useProjectDetail(projectId: string, initialProcessId: string | null) {
  const nav = useSandboxNavigation();
  const project = useProject(projectId);
  const git = useProjectGit(projectId, Boolean(project.data?.git));
  const processes = useProcesses({ projectId });
  const builds = useBuilds({ projectId });
  const artifacts = useArtifacts({ projectId });
  const ports = useListeningPorts();
  const openSite = useOpenSite();
  const startProcess = useStartProcess();
  const stopProcess = useConfirmedStop();
  const startBuild = useStartBuild();
  const downloads = useArtifactDownload();
  const sync = useSyncBack(projectId);
  const bookmarks = useScriptBookmarks(projectId);
  const appRuns = useAppRuns(projectId);
  const chats = useProjectChats(projectId);
  const fix = useFixWithAi();
  const [openLogs, setOpenLogs] = useState<{ id: string; in: LogsHost } | null>(
    initialProcessId ? { id: initialProcessId, in: "process" } : null,
  );
  const logs = useLogStream(openLogs ? { kind: "process", id: openLogs.id } : null);
  const toggleLogs = useCallback(
    (id: string, host: LogsHost) =>
      setOpenLogs((current) => (current?.id === id && current.in === host ? null : { id, in: host })),
    [],
  );
  const logsOpen = useCallback(
    (id: string | undefined, host: LogsHost) => id !== undefined && openLogs?.id === id && openLogs.in === host,
    [openLogs],
  );
  const { refreshing, refresh } = useSandboxRefresh();
  const data = project.data;
  const claudeAccount = useProjectClaudeAccount(data);
  const rename = useProjectRename();
  const openRename = rename.open;

  const runScript = useCallback(
    (script: string, display: boolean) => {
      if (!data) return;
      startProcess.mutate(
        { projectId, command: runScriptCommand(data, script), name: script, display },
        { onSuccess: (process) => setOpenLogs({ id: process.id, in: "script" }) },
      );
    },
    [data, projectId, startProcess],
  );

  const build = useCallback(
    (target: BuildTarget, profile: BuildProfile) =>
      startBuild.mutate({ projectId, target, profile }, { onSuccess: (job) => nav.build(job.id) }),
    [nav, projectId, startBuild],
  );

  const emulator = appRuns.emulator;
  const headerActions = useMemo<HeaderAction[]>(
    () => [
      ...(emulator
        ? [{ id: "emulator", icon: VIEWER_ICONS.android, label: emulator.label, hint: emulator.hint, disabled: emulator.busy, onPress: emulator.open }]
        : []),
      { ...PROJECT_ACTIONS.shell, onPress: () => nav.newTerminal({ kind: "shell", projectId }) },
      { ...PROJECT_ACTIONS.claudeSession, onPress: () => nav.newTerminal({ kind: "claude", projectId }) },
      { ...PROJECT_ACTIONS.askClaude, onPress: () => nav.newAgentRun(projectId) },
      { ...PROJECT_ACTIONS.rename, onPress: () => openRename({ id: projectId, title: data?.name ?? projectId }) },
    ],
    [emulator, nav, projectId, openRename, data?.name],
  );

  const sortedProcesses = useMemo(() => newestFirst(processes.data ?? [], (process) => process.startedAt), [processes.data]);

  const scripts = useMemo(() => {
    const latest = new Map<string, ProcessInfo>();
    for (const process of sortedProcesses) if (!latest.has(process.name)) latest.set(process.name, process);
    const all = (data?.scripts ?? []).map((script) => ({
      script,
      command: scriptCommand(data?.packageManager ?? null, script),
      bookmarked: bookmarks.isBookmarked(script),
      run: latest.get(script),
    }));
    return [...all.filter((entry) => entry.bookmarked), ...all.filter((entry) => !entry.bookmarked)];
  }, [data, bookmarks, sortedProcesses]);

  const sites = useMemo(() => projectSites(ports.data?.ports, projectId), [ports.data, projectId]);

  const siteFor = useCallback((processId: string) => processSite(ports.data?.ports, processId), [ports.data]);

  const requestError = startProcess.error ?? startBuild.error ?? stopProcess.error;
  const actionError = requestError ? describeError(requestError) : fix.error;

  return {
    nav,
    project: data,
    subtitle: data ? `${frameworkLabel(data.framework)} · ${gitSummaryLabel(data.git)}` : undefined,
    isLoading: project.isLoading,
    error: project.error ? describeError(project.error) : null,
    retry: () => void project.refetch(),
    headerActions,
    git: git.data,
    scripts,
    toggleBookmark: bookmarks.toggle,
    preferDisplay: data ? prefersDisplay(data.framework) : false,
    offerDisplay: emulator === null,
    runScript,
    runningScript: startProcess.isPending ? (startProcess.variables?.name ?? null) : null,
    targets: buildTargetOptions(data?.buildTargets ?? []),
    build,
    buildingTarget: startBuild.isPending ? (startBuild.variables?.target ?? null) : null,
    sites,
    siteFor,
    openSite: openSite.open,
    siteError: openSite.error,
    needsInstall: data?.dependenciesInstalled === false,
    processes: sortedProcesses,
    stopProcess: stopProcess.stop,
    stoppingId: stopProcess.stoppingId,
    logsOpen,
    toggleLogs,
    logs,
    builds: newestFirst(builds.data ?? [], (job) => job.createdAt, LIST_PREVIEW_LIMIT),
    artifacts: newestFirst(artifacts.data ?? [], (artifact) => artifact.createdAt),
    downloads,
    sync,
    claudeAccount,
    renameSheet: rename.sheet,
    appRuns,
    chats,
    fixProcess: fix.fixProcess,
    fixAppRun: fix.fixAppRun,
    fixingId: fix.pendingId,
    actionError,
    refreshing,
    refresh,
  };
}
