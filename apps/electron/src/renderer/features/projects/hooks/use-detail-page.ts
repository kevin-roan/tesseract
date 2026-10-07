import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigateTo } from "../../../app/navigation";
import { copyText } from "../../../components/CopyButton";
import { showToast } from "../../../components/Toast";
import { DEFAULT_PROJECT_TAB } from "../constants";
import { detailChips, detailTabs } from "../detail-view";
import { displayButton } from "../emulator";
import { DETAIL_LABELS } from "../labels";
import { claudeAccountOptions } from "../model";
import type { ProjectTabId } from "../types";
import { useClaudeAccount } from "./use-claude-account";
import { useProjectDetail } from "./use-project-detail";
import { useRemoveProject } from "./use-remove-project";

interface Options {
  projectId: string;
  initialTab: ProjectTabId | null;
  tabAt: number | null;
  syncCount: number | null;
  refreshSync(projectId: string): unknown;
  onRemoved(): void;
}

export function useDetailPage({ projectId, initialTab, tabAt, syncCount, refreshSync, onRemoved }: Options) {
  const navigate = useNavigateTo();
  const detail = useProjectDetail(projectId);
  const { state } = detail;
  const project = state.project;
  const [tab, setTab] = useState<ProjectTabId>(initialTab ?? DEFAULT_PROJECT_TAB);
  const [renameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab, tabAt]);

  const account = useClaudeAccount({ project, accounts: state.accounts, setProject: detail.setProject, report: detail.report });
  const removal = useRemoveProject(project, onRemoved);

  const chips = useMemo(
    () => (project ? detailChips({ project, processes: state.processes, builds: state.builds, runs: detail.runs, git: state.git, accounts: state.accounts }) : []),
    [project, state.processes, state.builds, detail.runs, state.git, state.accounts],
  );

  const tabs = useMemo(
    () => detailTabs({ processes: state.processes, builds: state.builds, artifacts: state.artifacts, sessions: state.sessions, syncCount }),
    [state.processes, state.builds, state.artifacts, state.sessions, syncCount],
  );

  const accountOptions = useMemo(() => (project && state.accounts ? claudeAccountOptions(project, state.accounts) : null), [project, state.accounts]);

  const display = useMemo(
    () => displayButton(state.runTargets, state.appRuns, project?.framework, state.runTargetsError),
    [state.runTargets, state.appRuns, project?.framework, state.runTargetsError],
  );

  const detailRefresh = detail.refresh;
  const refresh = useCallback(() => {
    detailRefresh();
    refreshSync(projectId);
  }, [detailRefresh, refreshSync, projectId]);

  const copyPath = useCallback(async () => {
    if (!project) return;
    if (await copyText(project.path)) showToast(DETAIL_LABELS.pathCopied);
  }, [project]);

  const actions = useMemo(
    () => ({
      ask: () => navigate("agents", { new: true, projectId }),
      claudeTerminal: () => navigate("terminals", { kind: "claude", projectId }),
      shell: () => navigate("terminals", { kind: "shell", projectId }),
      display: () => navigate("display"),
    }),
    [navigate, projectId],
  );

  const runDisplay = useCallback(() => {
    if (display.mode === "display") actions.display();
  }, [display.mode, actions]);

  return {
    detail,
    project,
    title: project ? project.name || project.id : projectId,
    tab,
    setTab,
    tabs,
    chips,
    account,
    accountOptions,
    accountValue: project?.claudeAccountId ?? "",
    display,
    runDisplay,
    actions,
    refresh,
    copyPath,
    removal,
    renameOpen,
    openRename: () => setRenameOpen(true),
    closeRename: () => setRenameOpen(false),
  };
}

export type DetailPage = ReturnType<typeof useDetailPage>;
