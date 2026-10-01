import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SyncRequest } from "@theone/protocol";

import type { HeaderAction } from "@/components/screen-header";

import { PAGE_ACTIONS } from "../utils/actions";
import { SYNC_CHANGES_REFRESH_INTERVAL_MS } from "../utils/constants";
import { describeError } from "../utils/errors";
import { syncDisabledReason, syncPullBody, syncRequestNotice, type SyncNotice } from "../utils/sync";
import { useSyncState } from "./use-sync-state";

/** One-tap "Sync to host" for a screen showing a project's work; `active` keeps the changed files fresh. */
export function useSyncToHost(projectId: string | null, active = false) {
  const { changesQuery, createRequest, changes, requests, empty, busy } = useSyncState(
    projectId ?? "",
    active ? SYNC_CHANGES_REFRESH_INTERVAL_MS : undefined,
  );
  const [started, setStarted] = useState<SyncRequest | null>(null);
  const { mutate: create, reset } = createRequest;
  const { refetch } = changesQuery;

  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active && projectId) void refetch();
    wasActive.current = active;
  }, [active, projectId, refetch]);

  const sync = useCallback(() => {
    if (!projectId) return;
    create({ projectId, ...syncPullBody(changes, false) }, { onSuccess: setStarted });
  }, [changes, create, projectId]);

  const dismiss = useCallback(() => {
    setStarted(null);
    reset();
  }, [reset]);

  const loaded = changesQuery.data !== undefined;
  const reason = syncDisabledReason(empty, busy);

  const action = useMemo<HeaderAction | null>(
    () =>
      projectId
        ? { ...PAGE_ACTIONS.syncToHost, onPress: sync, disabled: !loaded || reason !== null, hint: reason ?? undefined }
        : null,
    [loaded, projectId, reason, sync],
  );

  const request = started ? (requests.find((candidate) => candidate.id === started.id) ?? started) : null;
  const notice: SyncNotice | null = createRequest.error
    ? { tone: "danger", title: "Sync failed", message: describeError(createRequest.error) }
    : request
      ? syncRequestNotice(request, changesQuery.data)
      : null;

  return { action, notice, dismiss };
}

export type SyncToHostState = ReturnType<typeof useSyncToHost>;
