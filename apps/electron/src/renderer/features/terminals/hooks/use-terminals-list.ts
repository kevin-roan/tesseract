import { useQueryClient } from "@tanstack/react-query";
import type { TerminalInfo } from "@theone/protocol";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useIsOnline, useServerEvent, useWindowVisible } from "../../../app/connection";
import { DATA_KEYS, useApiClient, useApiQuery } from "../../../app/data";
import { LIST_REFRESH_MS, TERMINALS_QUERY_KEYS } from "../constants";
import { sortSessions } from "../model";
import { terminalSessions } from "../sessions";
import { useTerminalsUi } from "../store";

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
  const baseUrl = useApiClient()?.baseUrl ?? "none";
  const key = useMemo(() => DATA_KEYS.api(baseUrl, ...TERMINALS_QUERY_KEYS.list), [baseUrl]);
  const upsertTerminal = useCallback((info: TerminalInfo) => queryClient.setQueryData<TerminalInfo[]>(key, (list) => upsert(list, info)), [queryClient, key]);
  const removeTerminal = useCallback(
    (id: string) => queryClient.setQueryData<TerminalInfo[]>(key, (list) => list?.filter((item) => item.id !== id)),
    [queryClient, key],
  );
  const refresh = useCallback(() => void queryClient.invalidateQueries({ queryKey: key }), [queryClient, key]);
  return useMemo(() => ({ upsertTerminal, removeTerminal, refresh }), [upsertTerminal, removeTerminal, refresh]);
}

export function useTerminalsList() {
  const visible = useWindowVisible();
  const online = useIsOnline();
  const query = useApiQuery(TERMINALS_QUERY_KEYS.list, (client, signal) => client.listTerminals({ signal }), {
    refetchInterval: online ? (visible ? LIST_REFRESH_MS.visible : LIST_REFRESH_MS.hidden) : false,
  });
  const hidden = useTerminalsUi((state) => state.hidden);
  const cache = useTerminalsCache();
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
  useServerEvent("terminal.updated", (event) => {
    cache.upsertTerminal(event.terminal);
    terminalSessions.applyInfo(event.terminal);
  });
  const sessions = useMemo(
    () => (query.data ? sortSessions(query.data.filter((terminal) => !hidden.includes(terminal.id))) : null),
    [query.data, hidden],
  );
  return { sessions, loading: query.isPending, error: query.error };
}
