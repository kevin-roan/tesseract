import type { AgentRun } from "@theone/protocol";
import { useMemo } from "react";
import { describeError } from "../../../app/connection";
import { useApiClient } from "../../../app/data";
import { showToast } from "../../../components/Toast";
import { formatLabel, MANAGE_LABELS } from "../labels";
import { countLabel, deleteBodies, finishedIds } from "../model";
import { useAgentsUi, type PendingDelete } from "../store";
import { useRunsCache } from "./use-runs-cache";

export interface RunActions {
  setArchived(ids: readonly string[], archived: boolean, undoable?: boolean): Promise<void>;
  archiveAllFinished(runs: readonly AgentRun[] | null): Promise<void>;
  requestDelete(ids: readonly string[]): void;
  requestDeleteAllFinished(runs: readonly AgentRun[] | null): void;
  requestEmptyArchive(archived: readonly AgentRun[] | null): void;
  confirmDelete(pending: PendingDelete): Promise<void>;
  cancelDelete(): void;
}

const failed = (error: unknown) => showToast(formatLabel(MANAGE_LABELS.failed, { error: describeError(error) }));

export function useRunActions(): RunActions {
  const client = useApiClient();
  const cache = useRunsCache();

  return useMemo(() => {
    const applyArchived = (ids: readonly string[], archived: boolean) => {
      const ui = useAgentsUi.getState();
      const stamp = archived ? new Date().toISOString() : null;
      for (const id of ids) {
        const run = cache.find(id);
        if (run) cache.upsert({ ...run, archivedAt: stamp });
        else cache.remove([id]);
      }
      if (archived && ui.selectedRunId && ids.includes(ui.selectedRunId)) ui.closeDetail();
    };

    const setArchived = async (ids: readonly string[], archived: boolean, undoable = true): Promise<void> => {
      if (!client || ids.length === 0) return;
      try {
        const result = await client.archiveAgentRuns({ ids: [...ids], archived });
        applyArchived(ids, archived);
        const message = formatLabel(archived ? MANAGE_LABELS.archived : MANAGE_LABELS.unarchived, { count: countLabel(result.count) });
        showToast(message, undoable ? { action: { label: MANAGE_LABELS.undo, run: () => void setArchived(ids, !archived, false) } } : {});
      } catch (error) {
        failed(error);
      }
    };

    const archiveAllFinished = async (runs: readonly AgentRun[] | null): Promise<void> => {
      if (!client) return;
      const ids = finishedIds(runs);
      try {
        const result = await client.archiveAgentRuns({ all: true, archived: true });
        applyArchived(ids, true);
        showToast(formatLabel(MANAGE_LABELS.archived, { count: countLabel(result.count) }), {
          action: { label: MANAGE_LABELS.undo, run: () => void setArchived(ids, false, false) },
        });
      } catch (error) {
        failed(error);
      }
    };

    const setPending = useAgentsUi.getState().setPendingDelete;

    return {
      setArchived,
      archiveAllFinished,
      requestDelete: (ids) => {
        if (ids.length) setPending({ body: { ids: [...ids] }, ids, count: ids.length });
      },
      requestDeleteAllFinished: (runs) => {
        const ids = finishedIds(runs);
        if (ids.length) setPending({ body: { ids }, ids, count: ids.length });
      },
      requestEmptyArchive: (archived) => {
        const ids = finishedIds(archived);
        if (ids.length) setPending({ body: { all: true, archived: true }, ids, count: ids.length });
      },
      cancelDelete: () => setPending(null),
      confirmDelete: async (pending) => {
        setPending(null);
        if (!client) return;
        try {
          let deleted = 0;
          for (const body of deleteBodies(pending.body)) deleted += (await client.deleteAgentRuns(body)).count;
          cache.remove(pending.ids);
          const ui = useAgentsUi.getState();
          if (ui.selectedRunId && pending.ids.includes(ui.selectedRunId)) ui.closeDetail();
          showToast(formatLabel(MANAGE_LABELS.deleted, { count: countLabel(deleted) }));
        } catch (error) {
          failed(error);
        }
      },
    };
  }, [client, cache]);
}
