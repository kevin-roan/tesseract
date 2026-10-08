import { useQueryClient } from "@tanstack/react-query";
import type { ClaudeSession, InboxItem } from "@tesseract/protocol";
import { useCallback, useMemo } from "react";
import { DATA_KEYS, useApiClient, useApiQuery } from "../../../app/data";
import { AGENTS_QUERY_KEYS, DETAILS_INTERVAL_MS, INBOX_LIMIT, SESSIONS_LIMIT } from "../constants";
import { attentionCards, attentionItems, terminalSessions } from "../model";

const NO_ITEMS: InboxItem[] = [];
const NO_SESSIONS: ClaudeSession[] = [];

export function useAgentDetails(enabled = true) {
  const inbox = useApiQuery(AGENTS_QUERY_KEYS.inbox, (client, signal) => client.inbox({ limit: INBOX_LIMIT, unread: true }, { signal }), {
    enabled,
    refetchInterval: DETAILS_INTERVAL_MS,
  });
  const sessions = useApiQuery(AGENTS_QUERY_KEYS.sessions, (client, signal) => client.sessions({ limit: SESSIONS_LIMIT }, { signal }), {
    enabled,
    refetchInterval: DETAILS_INTERVAL_MS,
  });
  const items = inbox.data?.items ?? NO_ITEMS;
  const allSessions = sessions.data ?? NO_SESSIONS;
  return useMemo(
    () => ({
      items,
      sessions: allSessions,
      cards: attentionCards(items),
      attention: attentionItems(items),
      terminals: terminalSessions(allSessions),
    }),
    [items, allSessions],
  );
}

export function useRefreshDetails() {
  const queryClient = useQueryClient();
  const baseUrl = useApiClient()?.baseUrl ?? "none";
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: DATA_KEYS.api(baseUrl, ...AGENTS_QUERY_KEYS.inbox) });
    void queryClient.invalidateQueries({ queryKey: DATA_KEYS.api(baseUrl, ...AGENTS_QUERY_KEYS.sessions) });
  }, [queryClient, baseUrl]);
}

export function useInboxCache() {
  const queryClient = useQueryClient();
  const baseUrl = useApiClient()?.baseUrl ?? "none";
  return useMemo(() => {
    const key = DATA_KEYS.api(baseUrl, ...AGENTS_QUERY_KEYS.inbox);
    return {
      removeItem: (id: string) =>
        queryClient.setQueryData<{ items: InboxItem[] }>(key, (current) =>
          current ? { ...current, items: current.items.filter((item) => item.id !== id) } : current,
        ),
      refresh: () => void queryClient.invalidateQueries({ queryKey: key }),
    };
  }, [queryClient, baseUrl]);
}
