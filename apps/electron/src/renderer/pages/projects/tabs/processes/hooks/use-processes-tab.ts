import type { ProcessInfo, Project } from "@theone/protocol";
import { useCallback, useMemo, useState } from "react";
import { useConnectionClient, useWindowVisible } from "../../../../../app/connection";
import type { LogPanelAction } from "../../../../../components/LogPanel";
import { showToast } from "../../../../../components/Toast";
import { FIX_LOG_TAIL } from "../../../../../features/projects/constants";
import { useLogFollower } from "../../../../../features/projects/hooks/use-log-follower";
import { FIX_LABELS } from "../../../../../features/projects/labels";
import { canFixProcess, processFailurePrompt, projectProcesses } from "../../../../../features/projects/model";
import type { TabHost } from "../../../../../features/projects/hooks/use-tab-host";
import { KIT_LABELS, useConfirm, useCopyText, useFixWithAi, useOpenExternal, usePendingSet } from "../../kit";
import { PROCESSES_LABELS as L } from "../labels";
import { commandLabel, processName, scriptRequest } from "../model";
import { usePorts } from "./use-ports";

export interface ProcessesTabInput {
  project: Project;
  processes: readonly ProcessInfo[] | null;
  host: TabHost;
}

export function useProcessesTab({ project, processes: list, host }: ProcessesTabInput) {
  const { upsert, report } = host;
  const client = useConnectionClient();
  const windowVisible = useWindowVisible();
  const visible = host.visible && windowVisible;
  const ports = usePorts(client, project.id, visible);
  const fix = useFixWithAi(host);
  const [runOpen, setRunOpen] = useState(false);
  const upsertProcess = useCallback((item: ProcessInfo) => upsert("process", item), [upsert]);
  const follower = useLogFollower({ visible, onUpdate: (item) => upsertProcess(item as ProcessInfo) });
  const confirm = useConfirm();
  const stopping = usePendingSet();
  const starting = usePendingSet();
  const openUrl = useOpenExternal(report);
  const copy = useCopyText();

  const processes = useMemo(() => (list ? projectProcesses(list) : null), [list]);
  const shownId = follower.target?.kind === "process" ? follower.target.id : null;
  const shown = useMemo(() => processes?.find((process) => process.id === shownId) ?? null, [processes, shownId]);

  const openLogs = useCallback((process: ProcessInfo) => follower.follow("process", process.id), [follower]);

  const toggleLogs = useCallback(
    (process: ProcessInfo) => (shownId === process.id ? follower.stop() : openLogs(process)),
    [shownId, follower, openLogs],
  );

  const fixProcess = useCallback(
    (process: ProcessInfo) => {
      if (!client) return;
      fix.fix(
        process.id,
        () => client.processLogs(process.id, { tail: FIX_LOG_TAIL }),
        (lines) => processFailurePrompt({ ...process, command: commandLabel(process.command) }, lines),
      );
    },
    [client, fix],
  );

  const stop = useCallback(
    async (process: ProcessInfo) => {
      if (!client || stopping.has(process.id)) return;
      stopping.set(process.id, true);
      try {
        const updated = await client.stopProcess(process.id);
        upsertProcess(updated);
        showToast(L.stopped(processName(updated)));
      } catch (error) {
        report(error);
      } finally {
        stopping.set(process.id, false);
      }
    },
    [client, stopping, upsertProcess, report],
  );

  const askStop = useCallback(
    (process: ProcessInfo) =>
      confirm.ask({
        heading: L.stopTitle(processName(process)),
        body: L.stopBody,
        confirmLabel: L.stopConfirm,
        cancelLabel: L.cancel,
        onConfirm: () => void stop(process),
      }),
    [confirm, stop],
  );

  const started = useCallback(
    (process: ProcessInfo) => {
      upsertProcess(process);
      showToast(L.started(processName(process)));
      openLogs(process);
    },
    [upsertProcess, openLogs],
  );

  const runScript = useCallback(
    async (script: string, forceDisplay: boolean) => {
      if (starting.has(script)) return;
      if (!client) {
        report(new Error(KIT_LABELS.notConnected));
        return;
      }
      starting.set(script, true);
      try {
        started(await client.startProcess(scriptRequest(project, script, forceDisplay)));
      } catch (error) {
        report(error);
      } finally {
        starting.set(script, false);
      }
    },
    [client, starting, project, started, report],
  );

  const copyUrl = useCallback(
    async (url: string) => {
      if (await copy(url)) showToast(L.copied);
    },
    [copy],
  );

  const panelAction: LogPanelAction | null =
    shown && canFixProcess(shown)
      ? { label: FIX_LABELS.action, icon: "fix-ai", onClick: () => fixProcess(shown), sensitive: !fix.isPending(shown.id) }
      : null;

  return {
    ports,
    processes,
    follower,
    shownId,
    panelTitle: shown ? L.logsTitle(processName(shown)) : null,
    panelAction,
    confirm,
    client,
    runOpen,
    openRun: () => setRunOpen(true),
    closeRun: () => setRunOpen(false),
    started,
    toggleLogs,
    closeLogs: follower.stop,
    fix: fixProcess,
    isFixPending: fix.isPending,
    askStop,
    isStopping: (id: string) => stopping.pending.has(id),
    runScript,
    isStarting: (script: string) => starting.pending.has(script),
    copyUrl,
    openUrl,
  };
}

export type ProcessesTabModel = ReturnType<typeof useProcessesTab>;
