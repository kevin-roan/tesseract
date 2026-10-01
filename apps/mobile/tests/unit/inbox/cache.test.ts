import type { Inbox } from "@theone/protocol";
import { sampleInbox, sampleInboxItem } from "@theone/protocol/fixtures";

import { sessionKeys } from "@/features/chats/api/query-keys";
import { storeInboxEvent, storeInboxRead } from "@/features/inbox/api/cache";
import { subscribeInboxEvents } from "@/features/inbox/api/events";
import { inboxKeys } from "@/features/inbox/api/query-keys";
import { applyServerEvent } from "@/features/sandbox/api/cache";

import { createTestQueryClient } from "../sandbox/helpers";

const SANDBOX = "sbx_test";
const key = inboxKeys.list(SANDBOX);

describe("inbox cache", () => {
  it("upserts the item and takes the new counts from an inbox.updated event", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(key, sampleInbox);
    const fresh = { ...sampleInboxItem, id: "inb_new", kind: "needs_input" as const, updatedAt: "2026-09-23T11:00:00.000Z" };

    applyServerEvent(queryClient, SANDBOX, { type: "inbox.updated", item: fresh, unreadCount: 5, attentionCount: 2 });

    const inbox = queryClient.getQueryData<Inbox>(key);
    expect(inbox?.items[0].id).toBe("inb_new");
    expect(inbox?.items).toHaveLength(sampleInbox.items.length + 1);
    expect(inbox).toMatchObject({ unreadCount: 5, attentionCount: 2 });
  });

  it("refetches when nothing is cached or the event only carries counts, and refreshes chats on new items", () => {
    const queryClient = createTestQueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    storeInboxEvent(queryClient, SANDBOX, { type: "inbox.updated", item: sampleInboxItem, unreadCount: 1, attentionCount: 1 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key, exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: sessionKeys.lists(SANDBOX) });

    invalidate.mockClear();
    queryClient.setQueryData(key, sampleInbox);
    storeInboxEvent(queryClient, SANDBOX, { type: "inbox.updated", unreadCount: 0, attentionCount: 0 });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData<Inbox>(key)).toMatchObject({ unreadCount: 0, attentionCount: 0 });
  });

  it("forwards events to subscribers", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeInboxEvents(listener);
    const event = { type: "inbox.updated" as const, item: sampleInboxItem, unreadCount: 1, attentionCount: 1 };
    storeInboxEvent(createTestQueryClient(), SANDBOX, event);
    unsubscribe();
    storeInboxEvent(createTestQueryClient(), SANDBOX, event);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(SANDBOX, event);
  });

  it("marks items read locally with the server's counts", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(key, sampleInbox);
    storeInboxRead(queryClient, SANDBOX, "all", { unreadCount: 0, attentionCount: 0 }, "2026-09-24T00:00:00.000Z");
    const inbox = queryClient.getQueryData<Inbox>(key);
    expect(inbox?.items.every((entry) => entry.readAt !== null)).toBe(true);
    expect(inbox?.unreadCount).toBe(0);
  });
});
