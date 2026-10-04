import { useCallback, useMemo, useState } from "react";
import type { CreateSyncRequest, SyncDiscardResult, SyncRequest } from "@theone/protocol";

import { confirm } from "@/lib/confirm";

import { describeError } from "../utils/errors";
import {
  activeSyncRequest,
  discardableChanges,
  SYNC_REVERT_CONFIRM,
  syncActionReasons,
  syncDiscardBody,
  syncDiscardConfirm,
  syncDiscardNotice,
  syncEmptyState,
  syncFailureTitle,
  syncGetBody,
  syncPullBody,
  syncRequestNotice,
  type SyncActionId,
  type SyncNotice,
} from "../utils/sync";
import { useCreateSyncRequest, useDiscardSyncChanges } from "./use-sandbox-mutations";
import { useSyncChanges, useSyncRequests } from "./use-sandbox-queries";

type SyncOutcome = { type: "request"; request: SyncRequest } | { type: "discard"; result: SyncDiscardResult };

/** The changes, requests and the four sync actions (to host, from host, revert, discard) of a project. */
export function useSyncActions(projectId: string | null, refetchInterval?: number) {
  const changesQuery = useSyncChanges(projectId ?? "", refetchInterval);
  const requestsQuery = useSyncRequests(projectId ?? "");
  const createRequest = useCreateSyncRequest();
  const discardChanges = useDiscardSyncChanges();
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const { mutate: create, reset: resetCreate } = createRequest;
  const { mutate: discardMutate, reset: resetDiscard } = discardChanges;

  const changes = useMemo(() => changesQuery.data?.changes ?? [], [changesQuery.data]);
  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);
  const discardable = useMemo(() => discardableChanges(changes), [changes]);
  const active = activeSyncRequest(requests);
  const pending: SyncActionId | null = createRequest.isPending
    ? (createRequest.variables?.kind ?? null)
    : discardChanges.isPending
      ? "discard"
      : null;
  const busy = active !== null || pending !== null;
  const reasons = useMemo(() => syncActionReasons(changesQuery.data, requests, busy), [busy, changesQuery.data, requests]);

  const queue = useCallback(
    (body: CreateSyncRequest, onQueued?: () => void) => {
      if (!projectId) return;
      resetDiscard();
      create(
        { projectId, ...body },
        {
          onSuccess: (request) => {
            setOutcome({ type: "request", request });
            onQueued?.();
          },
        },
      );
    },
    [create, projectId, resetDiscard],
  );

  const pull = useCallback(
    (force = false, onQueued?: () => void) => queue(syncPullBody(changes, force), onQueued),
    [changes, queue],
  );

  const get = useCallback((force = false, onQueued?: () => void) => queue(syncGetBody(force), onQueued), [queue]);

  const revert = useCallback(async () => {
    if (await confirm(SYNC_REVERT_CONFIRM)) queue({ kind: "revert", source: "mobile" });
  }, [queue]);

  const discard = useCallback(
    (paths: readonly string[], onDone?: () => void) => {
      if (!projectId || paths.length === 0) return;
      resetCreate();
      discardMutate(
        { projectId, ...syncDiscardBody(paths) },
        {
          onSuccess: (result) => {
            setOutcome({ type: "discard", result });
            onDone?.();
          },
        },
      );
    },
    [discardMutate, projectId, resetCreate],
  );

  const confirmDiscard = useCallback(async () => {
    const paths = discardable.map((change) => change.path);
    if (paths.length > 0 && (await confirm(syncDiscardConfirm(paths)))) discard(paths);
  }, [discard, discardable]);

  const dismiss = useCallback(() => {
    setOutcome(null);
    resetCreate();
    resetDiscard();
  }, [resetCreate, resetDiscard]);

  const request =
    outcome?.type === "request" ? (requests.find((candidate) => candidate.id === outcome.request.id) ?? outcome.request) : null;
  const discardNotice = outcome?.type === "discard" ? syncDiscardNotice(outcome.result) : null;
  const error = createRequest.error ?? discardChanges.error;
  const failedAction: SyncActionId = createRequest.error ? (createRequest.variables?.kind ?? "pull") : "discard";
  const errorNotice: SyncNotice | null = error
    ? { tone: "danger", title: syncFailureTitle(failedAction), message: describeError(error) }
    : null;

  return {
    changesQuery,
    requestsQuery,
    changes,
    requests,
    discardable,
    empty: syncEmptyState(changesQuery.data),
    loaded: changesQuery.data !== undefined,
    reasons,
    pending,
    pull,
    get,
    revert: () => void revert(),
    discard,
    confirmDiscard: () => void confirmDiscard(),
    error: error ? describeError(error) : null,
    notice: errorNotice ?? discardNotice ?? (request ? syncRequestNotice(request, changesQuery.data) : null),
    discardNotice,
    dismiss,
  };
}

export type SyncActionsState = ReturnType<typeof useSyncActions>;
