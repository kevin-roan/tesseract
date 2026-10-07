import type { TerminalInfo } from "@theone/protocol";
import { useCallback, useMemo, useRef } from "react";
import { useApiClient } from "../../../app/data";
import { showToast } from "../../../components/Toast";
import { ERROR_LABELS } from "../labels";
import { estimateGrid, nextSelection } from "../model";
import { terminalSessions } from "../sessions";
import { useTerminalsUi } from "../store";
import type { LaunchRequest } from "../types";
import { useTerminalsCache } from "./use-terminals-list";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface StageMeasure {
  width: number;
  height: number;
}

export interface TerminalActions {
  select(id: string): void;
  launch(request: LaunchRequest): Promise<void>;
  requestClose(id: string): void;
  remove(id: string): Promise<void>;
  restart(id: string): void;
  reconnect(id: string): void;
}

export function useTerminalActions(sessions: readonly TerminalInfo[] | null, measureStage: () => StageMeasure | null): TerminalActions {
  const client = useApiClient();
  const cache = useTerminalsCache();
  const busy = useRef(false);
  const latest = useRef({ sessions, measureStage });
  latest.current = { sessions, measureStage };

  const select = useCallback((id: string) => {
    const ui = useTerminalsUi.getState();
    ui.unhide(id);
    ui.setSelected(id);
    ui.setDrawerOpen(false);
    terminalSessions.attach(id);
  }, []);

  const launch = useCallback(
    async ({ kind, projectId }: LaunchRequest) => {
      if (busy.current) return;
      const ui = useTerminalsUi.getState();
      if (!client) {
        showToast(ERROR_LABELS.create(ERROR_LABELS.notConnected));
        return;
      }
      busy.current = true;
      ui.setCreating(true);
      try {
        const current = terminalSessions.get(ui.selectedId)?.host.grid();
        const stage = latest.current.measureStage();
        const grid = current && current.cols > 0 ? current : estimateGrid(stage?.width ?? 0, stage?.height ?? 0);
        const info = await client.createTerminal({ kind, cols: grid.cols, rows: grid.rows, ...(projectId ? { projectId } : {}) });
        cache.upsertTerminal(info);
        select(info.id);
      } catch (error) {
        showToast(ERROR_LABELS.create(message(error)));
      } finally {
        busy.current = false;
        useTerminalsUi.getState().setCreating(false);
      }
    },
    [client, cache, select],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!client) return;
      try {
        await client.closeTerminal(id);
      } catch (error) {
        showToast(ERROR_LABELS.close(message(error)));
        return;
      }
      const ui = useTerminalsUi.getState();
      const order = (latest.current.sessions ?? []).map((session) => session.id);
      const wasCurrent = ui.selectedId === id;
      const next = wasCurrent ? nextSelection(order, ui.attached, id) : ui.selectedId;
      ui.hide(id);
      terminalSessions.detach(id);
      cache.removeTerminal(id);
      if (wasCurrent) {
        ui.setSelected(next);
        if (next) terminalSessions.attach(next);
      }
    },
    [client, cache],
  );

  const requestClose = useCallback(
    (id: string) => {
      const ui = useTerminalsUi.getState();
      const info = latest.current.sessions?.find((session) => session.id === id);
      const live = ui.live[id];
      const ended = live ? live.state === "exited" : info?.state === "exited";
      if (ended) void remove(id);
      else ui.setConfirmId(id);
    },
    [remove],
  );

  const restart = useCallback(
    (id: string) => {
      const info = latest.current.sessions?.find((session) => session.id === id);
      if (info) void launch({ kind: info.kind, projectId: info.projectId });
    },
    [launch],
  );

  const reconnect = useCallback((id: string) => terminalSessions.get(id)?.link.reconnect(), []);

  return useMemo(() => ({ select, launch, requestClose, remove, restart, reconnect }), [select, launch, requestClose, remove, restart, reconnect]);
}
