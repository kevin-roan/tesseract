import { useCallback, useMemo, useState } from "react";

import { SYNC_ACTIONS } from "../utils/actions";
import { describeError } from "../utils/errors";
import {
  describeSyncRequest,
  describeSyncSheet,
  lastFailedOnConflicts,
  previewSyncChanges,
  SYNC_REQUEST_PREVIEW,
  syncActionDetail,
  syncChangesSummary,
  syncFileToggleLabel,
  syncHostChanges,
  syncHostLabel,
  type SyncActionId,
  type SyncSheetMode,
} from "../utils/sync";
import { useCancelSyncRequest } from "./use-sandbox-mutations";
import { useSyncActions } from "./use-sync-actions";
import { useToggle } from "./use-toggle";

const SECONDARY_ACTIONS = ["get", "revert", "discard"] as const satisfies readonly SyncActionId[];

/** The project screen's sync group: changed files, the four actions, and recent requests. */
export function useSyncBack(projectId: string) {
  const sync = useSyncActions(projectId);
  const { changesQuery, requestsQuery, changes, requests, discardable, reasons, pending } = sync;
  const cancelRequest = useCancelSyncRequest();
  const [expanded, toggleExpanded] = useToggle(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<SyncSheetMode>("pull");
  const [force, setForce] = useState(false);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());

  const preview = previewSyncChanges(changes, expanded);

  const selectedPaths = useMemo(
    () => discardable.filter((change) => !excluded.has(change.path)).map((change) => change.path),
    [discardable, excluded],
  );
  const selected = useMemo(() => new Set(selectedPaths), [selectedPaths]);

  const openSheet = useCallback((next: SyncSheetMode = "pull") => {
    setMode(next);
    setForce(false);
    setExcluded(new Set());
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const toggleFile = useCallback(
    (path: string) =>
      setExcluded((current) => {
        const next = new Set(current);
        if (!next.delete(path)) next.add(path);
        return next;
      }),
    [],
  );

  const { pull, get, discard } = sync;
  const submit = useCallback(() => {
    if (mode === "pull") pull(force, closeSheet);
    else if (mode === "get") get(force, closeSheet);
    else discard(selectedPaths, closeSheet);
  }, [closeSheet, discard, force, get, mode, pull, selectedPaths]);

  const sheet = useMemo(
    () => ({
      ...describeSyncSheet(mode, {
        changes,
        selected: selectedPaths.length,
        showForce: mode !== "discard" && lastFailedOnConflicts(requests, mode),
      }),
      icon: SYNC_ACTIONS[mode].icon,
    }),
    [changes, mode, requests, selectedPaths.length],
  );

  const openers = useMemo<Record<(typeof SECONDARY_ACTIONS)[number], () => void>>(
    () => ({ get: () => openSheet("get"), revert: sync.revert, discard: () => openSheet("discard") }),
    [openSheet, sync.revert],
  );

  const actions = SECONDARY_ACTIONS.map((id) => ({
    ...SYNC_ACTIONS[id],
    detail: syncActionDetail(id, reasons[id], changes, syncHostChanges(changesQuery.data)),
    disabled: reasons[id] !== null,
    onPress: openers[id],
  }));

  const recent = useMemo(
    () => requests.slice(0, SYNC_REQUEST_PREVIEW).map((request) => ({ id: request.id, view: describeSyncRequest(request) })),
    [requests],
  );
  const loadError = changesQuery.error ?? requestsQuery.error;

  return {
    loading: changesQuery.isLoading,
    loadError: loadError ? describeError(loadError) : null,
    actionError: sync.error ?? (cancelRequest.error ? describeError(cancelRequest.error) : null),
    notice: sync.discardNotice,
    dismissNotice: sync.dismiss,
    host: syncHostLabel(changesQuery.data),
    empty: sync.empty,
    changes,
    summary: syncChangesSummary(changes),
    files: preview.visible,
    fileToggleLabel: syncFileToggleLabel(changes.length, expanded),
    toggleExpanded,
    canSync: reasons.pull === null,
    syncing: pending === "pull",
    actions,
    sheetOpen,
    sheet,
    openSheet,
    closeSheet,
    selected,
    toggleFile,
    force,
    setForce,
    submitting: pending === mode,
    canSubmit: mode !== "discard" || selectedPaths.length > 0,
    submit,
    requests: recent,
    cancel: (requestId: string) => cancelRequest.mutate(requestId),
    cancellingId: cancelRequest.isPending ? (cancelRequest.variables ?? null) : null,
  };
}

export type SyncBackState = ReturnType<typeof useSyncBack>;
