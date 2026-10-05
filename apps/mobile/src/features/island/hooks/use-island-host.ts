import { useCallback, useMemo } from "react";

import { useBuilds } from "@/features/sandbox/hooks/use-sandbox-queries";
import { useCancelAgentRun, useCancelBuild, useStopProcess } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSettingsStore } from "@/features/settings/store/settings-store";

import { useIslandStore } from "../store/island-store";
import { capsuleTitle } from "../utils/format";
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
  const builds = useBuilds();
  const cancelRun = useCancelAgentRun();
  const cancelBuild = useCancelBuild();
  const stopProcess = useStopProcess();

  const expanded = useIslandStore((store) => store.expanded);
  const toggleExpanded = useIslandStore((store) => store.toggleExpanded);
  const setExpanded = useIslandStore((store) => store.setExpanded);
  const openCapture = useIslandStore((store) => store.openCapture);
  const sharedCount = useIslandStore((store) => store.sharedItems.length);
  const hasDraft = useIslandStore((store) => store.pendingDraft !== null);
  const captureOpen = useIslandStore((store) => store.captureOpen);
  const attachOpen = useIslandStore((store) => store.attachOpen);

  const live = hasLiveWork(state);
  const visible = (live && placement !== "hidden") || sharedCount > 0 || hasDraft;
  const runId = state.runs[0]?.id ?? null;
  const commandId = runId ? null : (state.commands[0]?.id ?? null);

  const collapse = useCallback(() => setExpanded(false), [setExpanded]);
  const openChat = useCallback(() => {
    setExpanded(false);
    if (runId) nav.agentRun(runId);
    else nav.newAgentRun();
  }, [runId, nav, setExpanded]);
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
    stop,
    capture,
    attachShared: attachQueuedShared,
  };
}
