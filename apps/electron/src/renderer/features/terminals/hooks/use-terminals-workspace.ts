import type { TerminalInfo } from "@tesseract/protocol";
import { useCallback, useMemo, useRef } from "react";
import { useScheme } from "../../../app/scheme";
import { bannerFor, kindIcon, runningCount, stateBadge } from "../model";
import { useTerminalsScope } from "../scope";
import type { BannerAction, LiveSession, SessionRowModel } from "../types";
import { xtermTheme } from "../xterm-options";
import { useElementSize } from "./use-element-size";
import { useNow } from "./use-now";
import { useSessionContext } from "./use-session-context";
import { useSplitLayout } from "./use-split-layout";
import { useTerminalActions } from "./use-terminal-actions";
import { useTerminalMenus } from "./use-terminal-menus";
import { useTerminalsList } from "./use-terminals-list";
import { useTerminalsParams } from "./use-terminals-params";

export interface TerminalsWorkspaceOptions {
  titleOf(info: TerminalInfo): string;
  rowOf(info: TerminalInfo, nowMs: number, live: LiveSession | undefined): SessionRowModel;
}

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

export function useTerminalsWorkspace({ titleOf, rowOf }: TerminalsWorkspaceOptions) {
  const { ui } = useTerminalsScope();
  const ready = useSessionContext();
  const list = useTerminalsList();
  const now = useNow();
  const scheme = useScheme();
  const layout = useSplitLayout();

  const selectedId = ui((state) => state.selectedId);
  const attached = ui((state) => state.attached);
  const live = ui((state) => state.live);
  const creating = ui((state) => state.creating);
  const confirmId = ui((state) => state.confirmId);
  const setConfirmId = ui((state) => state.setConfirmId);

  const [stageRef, stageSize] = useElementSize<HTMLDivElement>();
  const stageSizeRef = useRef(stageSize);
  stageSizeRef.current = stageSize;
  const actions = useTerminalActions(list.sessions, () => stageSizeRef.current);
  useTerminalsParams(actions, ready);

  const sessions = list.sessions;
  const rows = useMemo(() => sessions?.map((info) => rowOf(info, now, live[info.id])) ?? null, [sessions, rowOf, now, live]);
  const count = sessions ? runningCount(sessions) : 0;

  const selectedLive = selectedId ? (live[selectedId] ?? null) : null;
  const selectedInfo = selectedId ? (sessions?.find((info) => info.id === selectedId) ?? placeholderInfo(selectedId)) : null;
  const toolbarSession = useMemo(() => {
    if (!selectedInfo || !selectedLive) return null;
    return {
      icon: kindIcon(selectedInfo.kind),
      title: titleOf(selectedInfo),
      subtitle: selectedLive.title || selectedInfo.cwd || null,
      badge: stateBadge(selectedLive.state, selectedLive.exitCode),
      ended: selectedLive.state === "exited",
    };
  }, [selectedInfo, selectedLive, titleOf]);

  const menus = useTerminalMenus(selectedLive ? selectedId : null, selectedLive);
  const banner = bannerFor(selectedLive);

  const onBannerAction = useCallback(
    (action: BannerAction) => {
      if (!selectedId) return;
      if (action === "restart") actions.restart(selectedId);
      else actions.reconnect(selectedId);
    },
    [actions, selectedId],
  );

  const confirmInfo = confirmId ? (sessions?.find((info) => info.id === confirmId) ?? placeholderInfo(confirmId)) : null;

  return {
    layout,
    rows,
    count,
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
    confirm: confirmInfo ? { id: confirmInfo.id, title: titleOf(confirmInfo) } : null,
    cancelConfirm: () => setConfirmId(null),
  };
}

export type TerminalsWorkspace = ReturnType<typeof useTerminalsWorkspace>;
