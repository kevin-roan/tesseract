import type { QueryClient } from "@tanstack/react-query";
import type { Inbox, InboxCounts } from "@tesseract/protocol";

import { sessionKeys } from "@/features/chats/api/query-keys";

import { markItemsRead, upsertInboxItem } from "../utils/group";
import { emitInboxEvent, type InboxEvent } from "./events";
import { inboxKeys } from "./query-keys";

export function storeInboxEvent(queryClient: QueryClient, sandboxId: string, event: InboxEvent): void {
  const key = inboxKeys.list(sandboxId);
  const counts: InboxCounts = { unreadCount: event.unreadCount, attentionCount: event.attentionCount };
  const cached = queryClient.getQueryData<Inbox>(key);
  if (cached) {
    queryClient.setQueryData<Inbox>(key, {
      items: event.item ? upsertInboxItem(cached.items, event.item) : cached.items,
      ...counts,
    });
  }
  if (!cached || !event.item) void queryClient.invalidateQueries({ queryKey: key, exact: true });
  if (event.item) void queryClient.invalidateQueries({ queryKey: sessionKeys.lists(sandboxId) });
  emitInboxEvent(sandboxId, event);
}

export function storeInboxRead(
  queryClient: QueryClient,
  sandboxId: string,
  ids: readonly string[] | "all",
  counts: InboxCounts,
  readAt: string = new Date().toISOString(),
): void {
  queryClient.setQueryData<Inbox>(inboxKeys.list(sandboxId), (inbox) =>
    inbox ? { items: markItemsRead(inbox.items, ids, readAt), ...counts } : inbox,
  );
}
