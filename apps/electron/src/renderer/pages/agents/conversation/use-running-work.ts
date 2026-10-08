import { useCallback, useMemo, useState } from "react";
import { describeError, useConnectionClient } from "../../../app/connection";
import { useNavigateTo } from "../../../app/navigation";
import type { RecordRowProps } from "../../../components/RecordRow";
import { showToast } from "../../../components/Toast";
import { RUNNING_WORK_LABELS as L } from "../../../features/agents/labels";
import { runningCount, runningWork } from "../../../features/agents/running";
import { useActivityPoll } from "../../../features/projects/hooks/use-activity-poll";
import { targetLabel } from "../../../features/projects/model";
import type { ProjectTabId } from "../../../features/projects/types";
import { buildRow } from "../../projects/tabs/builds/rows";
import { processName } from "../../projects/tabs/processes/model";
import { processRow } from "../../projects/tabs/processes/rows";

export interface RunningStop {
  name: string;
  run(): Promise<unknown>;
}

export interface RunningRow {
  id: string;
  row: RecordRowProps;
}

export function useRunningWork(projectId: string | null | undefined) {
  const client = useConnectionClient();
  const navigate = useNavigateTo();
  const activity = useActivityPoll();
  const [pending, setPending] = useState<RunningStop | null>(null);
  const [stopping, setStopping] = useState<ReadonlySet<string>>(new Set());

  const work = useMemo(() => runningWork(projectId, activity.processes, activity.builds), [projectId, activity.processes, activity.builds]);

  const open = useCallback(
    (tab: ProjectTabId) => {
      if (projectId) navigate("projects", { projectId, tab });
    },
    [navigate, projectId],
  );

  const ask = useCallback(
    (id: string, name: string, stop: () => Promise<unknown>) =>
      setPending({
        name,
        run: async () => {
          setStopping((current) => new Set(current).add(id));
          try {
            await stop();
            showToast(L.stopped(name));
            activity.refresh();
          } catch (error) {
            showToast(describeError(error));
          } finally {
            setStopping((current) => {
              const next = new Set(current);
              next.delete(id);
              return next;
            });
          }
        },
      }),
    [activity],
  );

  const rows = useMemo<RunningRow[]>(() => {
    const now = Date.now();
    return [
      ...work.processes.map((process) => ({
        id: process.id,
        row: processRow(
          process,
          { logsOpen: false, fixPending: false, stopping: stopping.has(process.id), now },
          {
            fix: () => open("processes"),
            toggleLogs: () => open("processes"),
            stop: () => client && ask(process.id, processName(process), () => client.stopProcess(process.id)),
          },
        ),
      })),
      ...work.builds.map((build) => ({
        id: build.id,
        row: buildRow(
          build,
          { logsOpen: false, fixPending: false, cancelling: stopping.has(build.id), now },
          {
            fix: () => open("builds"),
            toggleLogs: () => open("builds"),
            cancel: () => client && ask(build.id, targetLabel(build.target), () => client.cancelBuild(build.id)),
          },
        ),
      })),
    ].map(({ id, row }) => ({ id, row: { ...row, actions: row.actions?.map((action) => (action.id === "logs" ? { ...action, label: L.openLogs } : action)) } }));
  }, [work, stopping, open, ask, client]);

  return {
    rows,
    count: runningCount(work),
    stop: {
      open: pending !== null,
      heading: pending ? L.stopTitle(pending.name) : "",
      confirm: () => void pending?.run(),
      close: () => setPending(null),
    },
  };
}
