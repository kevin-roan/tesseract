import { useMemo } from "react";
import type { AppRunAction, RunTarget } from "@tesseract/protocol";

import { useHostNavigation } from "@/features/host-shell/hooks/use-host-navigation";
import { describeError } from "@/features/sandbox/utils/errors";
import { confirm } from "@/lib/confirm";
import { resetSettled } from "@/lib/mutations";

import { EMULATOR_ACTION_HINTS, EMULATOR_ACTION_LABELS, STOP_RUN_CONFIRM } from "../utils/content";
import { RUN_TARGETS_REFRESH_INTERVAL_MS } from "../utils/constants";
import { appRunEntries, emulatorActionFor, emulatorDestination } from "../utils/runs";
import { useAppRunAction, useStartAppRun, useStopAppRun } from "./use-app-run-mutations";
import { useAppRunList, useRunTargets } from "./use-app-run-queries";
import { useOpenAppRun } from "./use-open-app-run";

export function useAppRuns(projectId: string) {
  const targets = useRunTargets(projectId, RUN_TARGETS_REFRESH_INTERVAL_MS);
  const runs = useAppRunList(projectId);
  const start = useStartAppRun();
  const stop = useStopAppRun();
  const action = useAppRunAction();
  const opener = useOpenAppRun();
  const hostNav = useHostNavigation();

  const entries = useMemo(() => appRunEntries(targets.data ?? [], runs.data ?? []), [targets.data, runs.data]);

  const clearOutcomes = () => resetSettled([start, stop, action]);
  const confirmStop = async (runId: string) => {
    if (!(await confirm(STOP_RUN_CONFIRM))) return;
    clearOutcomes();
    stop.mutate(runId);
  };

  const emulatorAction = useMemo(() => emulatorActionFor(entries), [entries]);
  const openOnEmulator = () => {
    if (!emulatorAction) return;
    const { entry } = emulatorAction;
    if (emulatorDestination(emulatorAction) === "host") return hostNav.open();
    if (emulatorAction.kind === "show") return opener.open(emulatorAction.run, entry.label);
    clearOutcomes();
    start.mutate({ projectId, target: entry.target }, { onSuccess: (run) => opener.open(run, entry.label) });
  };

  const failure = start.error ?? stop.error ?? action.error ?? targets.error ?? runs.error;

  return {
    entries,
    loading: targets.isLoading,
    error: failure ? describeError(failure) : null,
    start: (target: RunTarget) => {
      clearOutcomes();
      start.mutate({ projectId, target });
    },
    startingTarget: start.isPending ? (start.variables?.target ?? null) : null,
    stop: (runId: string) => void confirmStop(runId),
    stoppingId: stop.isPending ? (stop.variables ?? null) : null,
    runAction: (runId: string, kind: AppRunAction) => {
      clearOutcomes();
      action.mutate({ runId, action: kind });
    },
    pendingAction: action.isPending ? (action.variables ?? null) : null,
    open: opener.open,
    deeplinkFailureFor: opener.failureFor,
    copyManifest: opener.copy,
    emulator: emulatorAction
      ? {
          kind: emulatorAction.kind,
          label: EMULATOR_ACTION_LABELS[emulatorAction.kind],
          hint: (emulatorAction.kind === "setup" ? emulatorAction.reason : null) ?? EMULATOR_ACTION_HINTS[emulatorAction.kind],
          busy: start.isPending && start.variables?.target === emulatorAction.entry.target,
          open: openOnEmulator,
        }
      : null,
    setupEmulator: hostNav.open,
  };
}

export type AppRunsState = ReturnType<typeof useAppRuns>;
