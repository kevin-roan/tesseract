import { useCallback, useEffect, useMemo, useRef } from "react";
import { describeError } from "../../../app/connection";
import { useSyncActions, type SyncActionButton, type SyncActionsState } from "../../projects/tabs/sync/hooks/use-sync-actions";
import { useSyncView } from "../../projects/tabs/sync/hooks/use-sync-view";
import { syncWaiting } from "../../projects/tabs/sync/model";
import { SYNC_HEADER_ORDER } from "./constants";
import { SYNC_HEADER_LABELS } from "./labels";
import type { SyncReport } from "./model";
import type { ConversationSyncContext } from "./types";

export interface ConversationSyncState {
  buttons: SyncActionButton[];
  actions: SyncActionsState;
  projectId: string | null;
  discard: (() => void) | null;
}

export function useConversationSync(projectId: string | null, running: boolean, onReport: (report: SyncReport | null) => void): ConversationSyncState {
  const reportRef = useRef(onReport);
  reportRef.current = onReport;
  const sync = useSyncView(projectId, projectId !== null);
  const actions = useSyncActions({
    projectId,
    sync,
    report: (error: unknown) => reportRef.current({ message: describeError(error), tone: "danger" }),
  });

  useEffect(() => {
    if (actions.result) reportRef.current(actions.result);
  }, [actions.result]);

  const wasRunning = useRef(running);
  const { refresh } = sync;
  useEffect(() => {
    if (wasRunning.current && !running) refresh();
    wasRunning.current = running;
  }, [running, refresh]);

  const waiting = syncWaiting(sync.view);
  const buttons = useMemo(
    () =>
      SYNC_HEADER_ORDER.flatMap((id) => {
        const button = actions.buttons.find((candidate) => candidate.id === id);
        if (!button) return [];
        const attention = !button.disabled && (button.variant === "attention" || waiting[id]);
        return [{ ...button, label: SYNC_HEADER_LABELS[id], variant: attention ? "attention" : "secondary" } satisfies SyncActionButton];
      }),
    [actions.buttons, waiting],
  );
  const discardButton = actions.buttons.find((candidate) => candidate.id === "discard");
  const discard = discardButton && !discardButton.disabled ? discardButton.onClick : null;
  return { buttons, actions, projectId, discard };
}

export function useConversationSyncSlot(context: ConversationSyncContext, onDiscard: (discard: (() => void) | null) => void): ConversationSyncState {
  const { projectId, running, report } = context;
  const sync = useConversationSync(projectId, running, report);

  const reportRef = useRef(report);
  reportRef.current = report;
  const shownProject = useRef(projectId);
  useEffect(() => {
    if (shownProject.current === projectId) return;
    shownProject.current = projectId;
    reportRef.current(null);
  }, [projectId]);
  useEffect(() => () => reportRef.current(null), []);

  const discardRef = useRef(sync.discard);
  discardRef.current = sync.discard;
  const discard = useCallback(() => discardRef.current?.(), []);
  const canDiscard = sync.discard !== null;
  useEffect(() => onDiscard(canDiscard ? discard : null), [onDiscard, canDiscard, discard]);
  useEffect(() => () => onDiscard(null), [onDiscard]);

  return sync;
}
