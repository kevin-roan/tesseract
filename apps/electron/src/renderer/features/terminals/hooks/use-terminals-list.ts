import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TerminalInfo } from "@tesseract/protocol";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWindowVisible } from "../../../app/connection";
import { DATA_KEYS } from "../../../app/data";
import { LIST_REFRESH_MS, TERMINALS_QUERY_KEYS } from "../constants";
import { sortSessions } from "../model";
import { useTerminalsScope } from "../scope";

const upsert = (list: TerminalInfo[] | undefined, info: TerminalInfo) => {
  const current = list ?? [];
  const index = current.findIndex((item) => item.id === info.id);
  if (index === -1) return [info, ...current];
  const next = [...current];
  next[index] = info;
  return next;
};

export function useTerminalsCache() {
  const queryClient = useQueryClient();
  const baseUrl = useTerminalsScope().useClient()?.baseUrl ?? "none";
  const key = useMemo(() => DATA_KEYS.api(baseUrl, ...TERMINALS_QUERY_KEYS.list), [baseUrl]);
  const upsertTerminal = useCallback((info: TerminalInfo) => queryClient.setQueryData<TerminalInfo[]>(key, (list) => upsert(list, info)), [queryClient, key]);
  const removeTerminal = useCallback(
    (id: string) => queryClient.setQueryData<TerminalInfo[]>(key, (list) => list?.filter((item) => item.id !== id)),
    [queryClient, key],
  );
  const refresh = useCallback(() => void queryClient.invalidateQueries({ queryKey: key }), [queryClient, key]);
  return useMemo(() => ({ key, upsertTerminal, removeTerminal, refresh }), [key, upsertTerminal, removeTerminal, refresh]);
}

export function useTerminalsList() {
  const scope = useTerminalsScope();
  const client = scope.useClient();
  const visible = useWindowVisible();
  const online = scope.useOnline();
  const cache = useTerminalsCache();
  const query = useQuery({
    queryKey: cache.key,
    queryFn: ({ signal }) => {
      if (!client) throw new Error("Not connected");
      return client.listTerminals({ signal });
    },
    enabled: client !== null,
    refetchInterval: online ? (visible ? LIST_REFRESH_MS.visible : LIST_REFRESH_MS.hidden) : false,
  });
  const hidden = scope.ui((state) => state.hidden);
  const { refresh } = cache;
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) refresh();
    wasOnline.current = online;
  }, [online, refresh]);
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (visible && !wasVisible.current && online) refresh();
    wasVisible.current = visible;
  }, [visible, online, refresh]);
  scope.useTerminalUpdates((info) => {
    cache.upsertTerminal(info);
    scope.sessions.applyInfo(info);
  });
  const sessions = useMemo(
    () => (query.data ? sortSessions(query.data.filter((terminal) => !hidden.includes(terminal.id))) : null),
    [query.data, hidden],
  );
  return { sessions, loading: query.isPending, error: query.error };
}
