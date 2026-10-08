import { useQueryClient } from "@tanstack/react-query";
import type { TesseractClient } from "@tesseract/client";
import { useCallback, useEffect, useRef } from "react";
import { describeError } from "../../../../../app/connection";
import { DATA_KEYS, useApiClient, useApiQuery } from "../../../../../app/data";
import { ipc } from "../../../../../lib/ipc";
import { SYNC_POLL_MS, SYNC_QUERY_KEY } from "../constants";
import { EMPTY_SYNC_VIEW, syncConflicts, syncFiles, type SyncView } from "../model";
import { useSyncBackState } from "./use-syncback-state";

export const syncViewKey = (projectId: string) => ["projects", projectId, SYNC_QUERY_KEY] as const;

export async function loadSyncView(client: TesseractClient, projectId: string, signal?: AbortSignal): Promise<SyncView> {
  const [links, snapshots] = await Promise.all([
    ipc.syncback.links().catch(() => []),
    ipc.syncback.snapshots(projectId).catch(() => []),
  ]);
  const link = links.find((candidate) => candidate.projectId === projectId) ?? null;
  let changes;
  let requests;
  try {
    [changes, requests] = await Promise.all([client.syncChanges(projectId, { signal }), client.syncRequests(projectId, { signal })]);
  } catch (error) {
    return { ...EMPTY_SYNC_VIEW, link, snapshots, error: describeError(error) };
  }
  if (link === null) return { ...EMPTY_SYNC_VIEW, changes, requests, snapshots };
  const hostFiles = await ipc.syncback.hostChanges(projectId).catch(() => []);
  const conflicts = syncConflicts(changes.changes ?? [], hostFiles);
  return { ...EMPTY_SYNC_VIEW, link, changes, requests, snapshots, hostFiles, conflicts };
}

export interface SyncViewState {
  view: SyncView;
  loaded: boolean;
  busy: boolean;
  error: unknown;
  refresh(): void;
}

export function useSyncView(projectId: string | null, enabled = true): SyncViewState {
  const sync = useSyncBackState();
  const busy = projectId !== null && sync.busy.includes(projectId);
  const query = useApiQuery(syncViewKey(projectId ?? ""), (client, signal) => loadSyncView(client, projectId ?? "", signal), {
    enabled: enabled && projectId !== null,
    refetchInterval: SYNC_POLL_MS,
  });
  const { refetch } = query;
  const refresh = useCallback(() => void refetch(), [refetch]);
  const seen = useRef({ revision: sync.revision, busy });
  useEffect(() => {
    if (seen.current.revision === sync.revision && seen.current.busy === busy) return;
    seen.current = { revision: sync.revision, busy };
    if (enabled && projectId !== null) refresh();
  }, [sync.revision, busy, enabled, projectId, refresh]);
  return { view: query.data ?? EMPTY_SYNC_VIEW, loaded: query.data !== undefined, busy, error: query.error, refresh };
}

export function useSyncChangeCount(projectId: string | null): number {
  return syncFiles(useSyncView(projectId).view).length;
}

export function useRefreshSyncView(): (projectId: string) => Promise<void> {
  const queryClient = useQueryClient();
  const client = useApiClient();
  return useCallback(
    (projectId: string) => queryClient.invalidateQueries({ queryKey: DATA_KEYS.api(client?.baseUrl ?? "none", ...syncViewKey(projectId)) }),
    [queryClient, client],
  );
}
