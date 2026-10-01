import { useCallback, useMemo, useState } from "react";

import { confirm } from "@/lib/confirm";

import { describeError } from "../utils/errors";
import {
  canRevertLastSync,
  describeSyncRequest,
  lastPullFailedOnConflicts,
  previewSyncChanges,
  SYNC_REQUEST_PREVIEW,
  syncChangesSummary,
  syncConfirmMessage,
  syncFileToggleLabel,
  syncHostLabel,
  syncPullBody,
} from "../utils/sync";
import { useCancelSyncRequest } from "./use-sandbox-mutations";
import { useSyncState } from "./use-sync-state";
import { useToggle } from "./use-toggle";

export function useSyncBack(projectId: string) {
  const { changesQuery, requestsQuery, createRequest, changes, requests, empty, busy } = useSyncState(projectId);
  const cancelRequest = useCancelSyncRequest();
  const [expanded, toggleExpanded] = useToggle(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [force, setForce] = useState(false);
  const { mutate: create } = createRequest;

  const preview = previewSyncChanges(changes, expanded);

  const openSheet = useCallback(() => {
    setForce(false);
    setSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const submit = useCallback(
    () => create({ projectId, ...syncPullBody(changes, force) }, { onSuccess: () => setSheetOpen(false) }),
    [changes, create, force, projectId],
  );

  const revert = useCallback(async () => {
    const confirmed = await confirm({
      title: "Revert last sync?",
      message: "Monolith restores the host files from the snapshot it took before the last sync.",
      confirmLabel: "Revert",
      cancelLabel: "Keep changes",
      destructive: true,
    });
    if (confirmed) create({ projectId, kind: "revert", source: "mobile" });
  }, [create, projectId]);

  const recent = useMemo(
    () => requests.slice(0, SYNC_REQUEST_PREVIEW).map((request) => ({ id: request.id, view: describeSyncRequest(request) })),
    [requests],
  );
  const loadError = changesQuery.error ?? requestsQuery.error;
  const actionError = createRequest.error ?? cancelRequest.error;

  return {
    loading: changesQuery.isLoading,
    loadError: loadError ? describeError(loadError) : null,
    actionError: actionError ? describeError(actionError) : null,
    host: syncHostLabel(changesQuery.data),
    empty,
    changes,
    summary: syncChangesSummary(changes),
    confirmMessage: syncConfirmMessage(changes),
    files: preview.visible,
    fileToggleLabel: syncFileToggleLabel(changes.length, expanded),
    toggleExpanded,
    canSync: empty === null && !busy,
    syncing: createRequest.isPending && createRequest.variables?.kind === "pull",
    canRevert: !busy && canRevertLastSync(requests),
    reverting: createRequest.isPending && createRequest.variables?.kind === "revert",
    revert: () => void revert(),
    showForce: lastPullFailedOnConflicts(requests),
    force,
    setForce,
    sheetOpen,
    openSheet,
    closeSheet,
    submit,
    requests: recent,
    cancel: (requestId: string) => cancelRequest.mutate(requestId),
    cancellingId: cancelRequest.isPending ? (cancelRequest.variables ?? null) : null,
  };
}

export type SyncBackState = ReturnType<typeof useSyncBack>;
