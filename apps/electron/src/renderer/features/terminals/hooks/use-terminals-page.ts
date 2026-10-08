import type { TerminalInfo } from "@tesseract/protocol";
import { useCallback, useMemo, useRef } from "react";
import { useConnection, useConnectionActions } from "../../../app/connection";
import { usePreferencesRoute } from "../../../app/navigation";
import { useScheme } from "../../../app/scheme";
import { useWorkspaceProjects } from "../../projects/hooks/use-workspace";
import { bannerFor, connectionEmpty, kindIcon, rowModel, runningCount, sessionTitle, stateBadge } from "../model";
import { useTerminalsUi } from "../store";
import type { BannerAction } from "../types";
import { xtermTheme } from "../xterm-options";
import { useElementSize } from "./use-element-size";
import { useNow } from "./use-now";
import { useSessionContext } from "./use-session-context";
import { useSplitLayout } from "./use-split-layout";
import { useTerminalActions } from "./use-terminal-actions";
import { useTerminalMenus } from "./use-terminal-menus";
import { useTerminalsList } from "./use-terminals-list";
import { useTerminalsParams } from "./use-terminals-params";

const placeholderInfo = (id: string): TerminalInfo => ({
  id,
  kind: "shell",
  projectId: null,
  title: "",
  cwd: "",
  pid: null,
  cols: 0,
  rows: 0,
  state: "running",
  exitCode: null,
  createdAt: "",
});

export function useTerminalsPage() {
  const connection = useConnection();
  const connectionActions = useConnectionActions();
  const { openPreferences } = usePreferencesRoute();
  const ready = useSessionContext();
  const list = useTerminalsList();
  const { projects } = useWorkspaceProjects();
  const now = useNow();
  const scheme = useScheme();
  const layout = useSplitLayout();

  const selectedId = useTerminalsUi((state) => state.selectedId);
  const attached = useTerminalsUi((state) => state.attached);
  const live = useTerminalsUi((state) => state.live);
  const creating = useTerminalsUi((state) => state.creating);
  const confirmId = useTerminalsUi((state) => state.confirmId);
  const setConfirmId = useTerminalsUi((state) => state.setConfirmId);

  const [stageRef, stageSize] = useElementSize<HTMLDivElement>();
  const stageSizeRef = useRef(stageSize);
  stageSizeRef.current = stageSize;
  const actions = useTerminalActions(list.sessions, () => stageSizeRef.current);
  useTerminalsParams(actions, ready);

  const sessions = list.sessions;
  const rows = useMemo(() => sessions?.map((info) => rowModel(info, projects, now, live[info.id])) ?? null, [sessions, projects, now, live]);
  const count = sessions ? runningCount(sessions) : 0;

  const selectedLive = selectedId ? (live[selectedId] ?? null) : null;
  const selectedInfo = selectedId ? (sessions?.find((info) => info.id === selectedId) ?? placeholderInfo(selectedId)) : null;
  const toolbarSession = useMemo(() => {
    if (!selectedInfo || !selectedLive) return null;
    return {
      icon: kindIcon(selectedInfo.kind),
      title: sessionTitle(selectedInfo, projects),
      subtitle: selectedLive.title || selectedInfo.cwd || null,
      badge: stateBadge(selectedLive.state, selectedLive.exitCode),
      ended: selectedLive.state === "exited",
    };
  }, [selectedInfo, selectedLive, projects]);

  const menus = useTerminalMenus(selectedLive ? selectedId : null, selectedLive);
  const banner = bannerFor(selectedLive);
  const empty = attached.length === 0 ? connectionEmpty(connection.status, connection.errorMessage) : null;

  const onBannerAction = useCallback(
    (action: BannerAction) => {
      if (!selectedId) return;
      if (action === "restart") actions.restart(selectedId);
      else actions.reconnect(selectedId);
    },
    [actions, selectedId],
  );

  const onEmptyAction = useCallback(() => {
    if (empty?.action === "retry") connectionActions.refresh();
    else if (empty?.action === "preferences") openPreferences("connection");
  }, [empty?.action, connectionActions, openPreferences]);

  const confirmInfo = confirmId ? (sessions?.find((info) => info.id === confirmId) ?? placeholderInfo(confirmId)) : null;

  return {
    layout,
    empty,
    onEmptyAction,
    rows,
    count,
    projects,
    creating,
    selectedId,
    attached,
    toolbarVisible: toolbarSession !== null || layout.collapsed,
    toolbarSession,
    menus,
    banner,
    onBannerAction,
    background: xtermTheme(scheme).background ?? "",
    stageRef,
    actions,
    confirm: confirmInfo ? { id: confirmInfo.id, title: sessionTitle(confirmInfo, projects) } : null,
    cancelConfirm: () => setConfirmId(null),
  };
}
