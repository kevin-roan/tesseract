import type { TerminalKind } from "@tesseract/protocol";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useScheme } from "../../../app/scheme";
import { bannerFor } from "../model";
import { clampPanelSize, panelBounds, panelTabs, type PanelPlacement } from "../panel-model";
import { useTerminalPanelStore } from "../panel-store";
import { useTerminalsScope } from "../scope";
import type { BannerAction } from "../types";
import { xtermTheme } from "../xterm-options";
import { useElementSize } from "./use-element-size";
import { useSessionContext } from "./use-session-context";
import { useTerminalActions } from "./use-terminal-actions";
import { useTerminalMenus } from "./use-terminal-menus";
import { useTerminalsList } from "./use-terminals-list";

export function useProjectTerminalPanel(projectId: string) {
  const { sessions, ui } = useTerminalsScope();
  const ready = useSessionContext();
  const list = useTerminalsList();
  const scheme = useScheme();

  const open = useTerminalPanelStore((state) => state.openProjects.includes(projectId));
  const placement = useTerminalPanelStore((state) => state.placement);
  const storedSize = useTerminalPanelStore((state) => state.sizes[state.placement]);
  const setOpen = useTerminalPanelStore((state) => state.setOpen);
  const setStoredPlacement = useTerminalPanelStore((state) => state.setPlacement);
  const setStoredSize = useTerminalPanelStore((state) => state.setSize);

  const selectedId = ui((state) => state.selectedId);
  const attached = ui((state) => state.attached);
  const live = ui((state) => state.live);
  const creating = ui((state) => state.creating);
  const confirmId = ui((state) => state.confirmId);
  const setConfirmId = ui((state) => state.setConfirmId);

  const [dockRef, dockSize] = useElementSize<HTMLDivElement>();
  const [stageRef, stageSize] = useElementSize<HTMLDivElement>();
  const stageSizeRef = useRef(stageSize);
  stageSizeRef.current = stageSize;
  const actions = useTerminalActions(list.sessions, () => stageSizeRef.current);

  const tabs = useMemo(() => panelTabs(list.sessions, projectId), [list.sessions, projectId]);
  const activeId = tabs.some((tab) => tab.id === selectedId) ? selectedId : (tabs[0]?.id ?? null);
  const needsAttach = activeId !== null && (activeId !== selectedId || !attached.includes(activeId));

  useEffect(() => {
    if (open && ready && needsAttach && activeId) actions.select(activeId);
  }, [open, ready, needsAttach, activeId, actions]);

  const latest = useRef({ tabs, activeId });
  latest.current = { tabs, activeId };

  const openKind = useCallback(
    (kind: TerminalKind) => {
      setOpen(projectId, true);
      const { tabs: current, activeId: active } = latest.current;
      const existing = current.find((tab) => tab.id === active && tab.kind === kind) ?? current.find((tab) => tab.kind === kind);
      if (!existing) {
        void actions.launch({ kind, projectId });
        return;
      }
      actions.select(existing.id);
      sessions.get(existing.id)?.host.focus();
    },
    [actions, projectId, sessions, setOpen],
  );

  const available = dockSize ? (placement === "right" ? dockSize.width : dockSize.height) : null;
  const bounds = panelBounds(placement, available);
  const setSize = useCallback((size: number) => setStoredSize(placement, size), [placement, setStoredSize]);

  const selectedLive = activeId ? (live[activeId] ?? null) : null;
  const menus = useTerminalMenus(selectedLive ? activeId : null, selectedLive);

  const onBannerAction = useCallback(
    (action: BannerAction) => {
      if (!activeId) return;
      if (action === "restart") actions.restart(activeId);
      else actions.reconnect(activeId);
    },
    [actions, activeId],
  );

  const confirmTab = tabs.find((tab) => tab.id === confirmId);

  return {
    open,
    placement,
    size: clampPanelSize(storedSize, bounds),
    bounds,
    tabs,
    activeId,
    attached,
    creating,
    dockRef,
    stageRef,
    background: xtermTheme(scheme).background ?? "",
    banner: bannerFor(selectedLive),
    contextMenu: menus.context,
    confirm: confirmTab ? { id: confirmTab.id, title: confirmTab.label } : null,
    actions,
    openKind,
    launch: (kind: TerminalKind) => void actions.launch({ kind, projectId }),
    hide: () => setOpen(projectId, false),
    setPlacement: (next: PanelPlacement) => setStoredPlacement(next),
    setSize,
    onBannerAction,
    cancelConfirm: () => setConfirmId(null),
  };
}

export type ProjectTerminalPanel = ReturnType<typeof useProjectTerminalPanel>;
