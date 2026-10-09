import { useCallback, useMemo } from "react";
import { usePathname } from "expo-router";

import { useBuilds } from "@/features/sandbox/hooks/use-sandbox-queries";
import { useCancelAgentRun, useCancelBuild, useStopProcess } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSettingsStore } from "@/features/settings/store/settings-store";

import { useIslandStore } from "../store/island-store";
import { capsuleTitle, focusedItem, islandItems, islandPanelHeight } from "../utils/format";
import { hasLiveWork, isBuildCommand } from "../utils/state";
import { useIslandActions } from "./use-island-actions";
import { useIslandDispatch } from "./use-island-dispatch";
import { useIslandState } from "./use-island-state";
import { useLiveActivity } from "./use-live-activity";

export type IslandHostState = ReturnType<typeof useIslandHost>;

export function useIslandHost() {
  const state = useIslandState();
  const placement = useSettingsStore((store) => store.islandPlacement);
  const dock = useSettingsStore((store) => store.islandDock);
  const setDock = useSettingsStore((store) => store.setIslandDock);
  const liveActivity = useSettingsStore((store) => store.liveActivity);
  useLiveActivity(state, liveActivity);
  useIslandActions();
  const { attachQueuedShared } = useIslandDispatch();
  const nav = useSandboxNavigation();
  const pathname = usePathname();
  const builds = useBuilds();
  const cancelRun = useCancelAgentRun();
  const cancelBuild = useCancelBuild();
  const stopProcess = useStopProcess();

  const expanded = useIslandStore((store) => store.expanded);
  const focusedId = useIslandStore((store) => store.focusedId);
  const focus = useIslandStore((store) => store.setFocusedId);
  const toggleExpanded = useIslandStore((store) => store.toggleExpanded);
  const setExpanded = useIslandStore((store) => store.setExpanded);
  const openCapture = useIslandStore((store) => store.openCapture);
  const sharedCount = useIslandStore((store) => store.sharedItems.length);
  const hasDraft = useIslandStore((store) => store.pendingDraft !== null);
  const captureOpen = useIslandStore((store) => store.captureOpen);
  const attachOpen = useIslandStore((store) => store.attachOpen);

  const live = hasLiveWork(state);
  const visible = (live && placement !== "hidden") || sharedCount > 0 || hasDraft;
  const items = useMemo(() => islandItems(state), [state]);
  const focused = focusedItem(items, focusedId);
  const runId = focused?.kind === "run" ? focused.id : null;
  const commandId = focused?.kind === "command" ? focused.id : null;

  const collapse = useCallback(() => setExpanded(false), [setExpanded]);
  /** Opening the chat already on screen only folds the island, rather than stacking a second copy of it. */
  const openRun = useCallback(
    (id: string) => {
      setExpanded(false);
      if (pathname !== `/sandbox/agent/${id}`) nav.agentRun(id);
    },
    [pathname, nav, setExpanded],
  );
  const openChat = useCallback(() => {
    if (runId) openRun(runId);
    else {
      setExpanded(false);
      nav.newAgentRun();
    }
  }, [runId, openRun, nav, setExpanded]);
  const panelHeight = islandPanelHeight(items.length);
  const capture = useCallback(() => openCapture(), [openCapture]);

  const { mutate: cancelRunMutate } = cancelRun;
  const { mutate: cancelBuildMutate } = cancelBuild;
  const { mutate: stopProcessMutate } = stopProcess;
  const stop = useCallback(() => {
    if (runId) cancelRunMutate(runId);
    else if (commandId) (isBuildCommand(commandId, builds.data) ? cancelBuildMutate : stopProcessMutate)(commandId);
  }, [runId, commandId, builds.data, cancelRunMutate, cancelBuildMutate, stopProcessMutate]);

  const stoppingRunId = cancelRun.isPending ? (cancelRun.variables ?? null) : null;
  const stoppingCommandId = cancelBuild.isPending ? (cancelBuild.variables ?? null) : stopProcess.isPending ? (stopProcess.variables ?? null) : null;
  const stopping = runId ? stoppingRunId === runId : commandId !== null && stoppingCommandId === commandId;

  const title = useMemo(
    () => capsuleTitle(state.runs.length, state.commands.length, sharedCount, hasDraft),
    [state.runs.length, state.commands.length, sharedCount, hasDraft],
  );

  return {
    state,
    items,
    focused,
    focus,
    visible: visible && !captureOpen && !attachOpen,
    expanded,
    title,
    dock,
    moveTo: setDock,
    sharedCount,
    hasDraft,
    stopping,
    toggle: toggleExpanded,
    collapse,
    openChat,
    panelHeight,
    stop,
    capture,
    attachShared: attachQueuedShared,
  };
}
