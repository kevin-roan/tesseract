import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useIsOnline, useWindowVisible } from "../../../app/connection";
import { DATA_KEYS, useApiClient, useApiQuery } from "../../../app/data";
import { PROCESSES_QUERY_KEYS, REFRESH_MS } from "../constants";

export function useRuntimeKey() {
  const baseUrl = useApiClient()?.baseUrl ?? "none";
  return useMemo(() => DATA_KEYS.api(baseUrl, ...PROCESSES_QUERY_KEYS.runtime), [baseUrl]);
}

export function useRuntimeList() {
  const visible = useWindowVisible();
  const online = useIsOnline();
  const queryClient = useQueryClient();
  const key = useRuntimeKey();
  const query = useApiQuery(PROCESSES_QUERY_KEYS.runtime, (client, signal) => client.runtime({ signal }), {
    enabled: online,
    refetchInterval: online ? (visible ? REFRESH_MS.visible : REFRESH_MS.hidden) : false,
    retry: false,
  });
  const refresh = useCallback(() => void queryClient.invalidateQueries({ queryKey: key }), [queryClient, key]);
  return {
    entries: query.data?.entries ?? null,
    loading: query.isPending && online,
    error: query.error,
    refresh,
  };
}
