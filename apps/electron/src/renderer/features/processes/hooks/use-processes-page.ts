import { useCallback, useMemo, useState } from "react";
import { describeError, useConnection, useConnectionActions } from "../../../app/connection";
import { usePreferencesRoute } from "../../../app/navigation";
import { useNow } from "../../agents/hooks/use-now";
import { useWorkspaceProjects } from "../../projects/hooks/use-workspace";
import { UPTIME_TICK_MS } from "../constants";
import { connectionEmpty, connectionNotice, processGroups, projectNames } from "../model";
import type { ProcessTarget } from "../types";
import { useHostDeviceList } from "./use-host-device-list";
import { useRuntimeList } from "./use-runtime-list";
import { usePendingStops, useStopProcess } from "./use-stop-process";

export type ProcessesStatus = "connection" | "loading" | "error" | "empty" | "content";

export function useProcessesPage() {
  const connection = useConnection();
  const connectionActions = useConnectionActions();
  const { openPreferences } = usePreferencesRoute();
  const runtime = useRuntimeList();
  const host = useHostDeviceList();
  const { projects } = useWorkspaceProjects();
  const now = useNow(UPTIME_TICK_MS);
  const pending = usePendingStops();
  const [killTarget, setKillTarget] = useState<ProcessTarget | null>(null);

  const { refresh: refreshRuntime } = runtime;
  const { refresh: refreshHost } = host;
  const refresh = useCallback(() => {
    refreshRuntime();
    refreshHost();
  }, [refreshRuntime, refreshHost]);
  const actions = useStopProcess({ host, onSettled: refreshRuntime });

  const names = useMemo(() => projectNames(projects), [projects]);
  const groups = useMemo(() => processGroups(runtime.entries ?? [], host.devices, names, now), [runtime.entries, host.devices, names, now]);
  const offline = useMemo(() => connectionEmpty(connection.status, connection.errorMessage), [connection.status, connection.errorMessage]);

  const status: ProcessesStatus =
    offline && groups.length === 0
      ? "connection"
      : !offline && runtime.entries === null && runtime.error
        ? "error"
        : !offline && runtime.loading
          ? "loading"
          : groups.length === 0
            ? "empty"
            : "content";

  const runConnectionAction = useCallback(() => {
    if (offline?.action === "retry") connectionActions.refresh();
    else if (offline?.action === "preferences") openPreferences("connection");
  }, [offline?.action, connectionActions, openPreferences]);

  return {
    status,
    groups,
    offline,
    notice: useMemo(() => connectionNotice(offline), [offline]),
    error: runtime.error ? describeError(runtime.error) : null,
    pending,
    refresh,
    runConnectionAction,
    stop: actions.stop,
    requestKill: setKillTarget,
    killTarget,
    closeKill: useCallback(() => setKillTarget(null), []),
    kill: actions.kill,
  };
}

export type ProcessesPageModel = ReturnType<typeof useProcessesPage>;
