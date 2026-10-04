import { useCallback, useMemo, useState } from "react";
import type { BuildProfile, BuildTarget } from "@theone/protocol";

import type { HeaderAction } from "@/components/screen-header";
import { useProjectClaudeAccount } from "@/features/claude-account/hooks/use-project-claude-account";

import { PROJECT_ACTIONS } from "../utils/actions";
import { newestFirst } from "../utils/collections";
import { LIST_PREVIEW_LIMIT } from "../utils/constants";
import { describeError } from "../utils/errors";
import { buildTargetOptions, frameworkLabel } from "../utils/labels";
import { gitSummaryLabel, prefersDisplay, scriptCommand } from "../utils/projects";
import { processSite, projectSites } from "../utils/sites";
import { useArtifactDownload } from "./use-artifact-download";
import { useLogStream } from "./use-log-stream";
import { useOpenSite } from "./use-open-site";
import { useConfirmedStop } from "./use-confirmed-stop";
import { useStartBuild, useStartProcess } from "./use-sandbox-mutations";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useArtifacts, useBuilds, useListeningPorts, useProcesses, useProject, useProjectGit } from "./use-sandbox-queries";
import { useSandboxRefresh } from "./use-sandbox-refresh";
import { useScriptBookmarks } from "./use-script-bookmarks";
import { useSyncBack } from "./use-sync-back";

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
  const [logsId, setLogsId] = useState<string | null>(initialProcessId);
  const logs = useLogStream(logsId ? { kind: "process", id: logsId } : null);
  const { refreshing, refresh } = useSandboxRefresh();
  const data = project.data;
  const claudeAccount = useProjectClaudeAccount(data);

  const runScript = useCallback(
    (script: string, display: boolean) => {
      if (!data) return;
      startProcess.mutate(
        { projectId, command: scriptCommand(data.packageManager, script), name: script, display },
        { onSuccess: (process) => setLogsId(process.id) },
      );
    },
    [data, projectId, startProcess],
  );

  const build = useCallback(
    (target: BuildTarget, profile: BuildProfile) =>
      startBuild.mutate({ projectId, target, profile }, { onSuccess: (job) => nav.build(job.id) }),
    [nav, projectId, startBuild],
  );

  const headerActions = useMemo<HeaderAction[]>(
    () => [
      { ...PROJECT_ACTIONS.shell, onPress: () => nav.newTerminal({ kind: "shell", projectId }) },
      { ...PROJECT_ACTIONS.claudeSession, onPress: () => nav.newTerminal({ kind: "claude", projectId }) },
      { ...PROJECT_ACTIONS.askClaude, onPress: () => nav.newAgentRun(projectId) },
    ],
    [nav, projectId],
  );

  const scripts = useMemo(() => {
    const all = (data?.scripts ?? []).map((script) => ({
      script,
      command: scriptCommand(data?.packageManager ?? null, script),
      bookmarked: bookmarks.isBookmarked(script),
    }));
    return [...all.filter((entry) => entry.bookmarked), ...all.filter((entry) => !entry.bookmarked)];
  }, [data, bookmarks]);

  const sites = useMemo(() => projectSites(ports.data?.ports, projectId), [ports.data, projectId]);

  const siteFor = useCallback((processId: string) => processSite(ports.data?.ports, processId), [ports.data]);

  const actionError = startProcess.error ?? startBuild.error ?? stopProcess.error;

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
    runScript,
    runningScript: startProcess.isPending ? (startProcess.variables?.name ?? null) : null,
    targets: buildTargetOptions(data?.buildTargets ?? []),
    build,
    buildingTarget: startBuild.isPending ? (startBuild.variables?.target ?? null) : null,
    sites,
    siteFor,
    openSite: openSite.open,
    siteError: openSite.error,
    processes: newestFirst(processes.data ?? [], (process) => process.startedAt),
    stopProcess: stopProcess.stop,
    stoppingId: stopProcess.stoppingId,
    logsId,
    toggleLogs: (id: string) => setLogsId((current) => (current === id ? null : id)),
    logs,
    builds: newestFirst(builds.data ?? [], (job) => job.createdAt, LIST_PREVIEW_LIMIT),
    artifacts: newestFirst(artifacts.data ?? [], (artifact) => artifact.createdAt),
    downloads,
    sync,
    claudeAccount,
    actionError: actionError ? describeError(actionError) : null,
    refreshing,
    refresh,
  };
}
