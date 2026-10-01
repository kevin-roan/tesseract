import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import {
  ClaudeHookPayloadSchema,
  ID_PREFIXES,
  INBOX_KINDS,
  InboxCountsSchema,
  InboxItemSchema,
  InboxQuerySchema,
  InboxSchema,
  LIMITS,
  MarkInboxReadSchema,
  restPaths,
  routePatterns,
  SERVER_EVENT_TYPES,
  ServerEventSchema,
} from "../src/index";
import { sampleInbox, sampleInboxItem } from "../src/fixtures";

function roundTrip<T extends z.ZodType>(schema: T, value: unknown) {
  const parsed = schema.parse(JSON.parse(JSON.stringify(value)));
  expect(parsed as unknown).toEqual(value);
  return parsed;
}

function rejects(schema: z.ZodType, value: unknown) {
  expect(schema.safeParse(value).success).toBe(false);
}

describe("inbox routes", () => {
  test("paths and query strings", () => {
    expect(restPaths.inbox()).toBe("/v1/inbox");
    expect(restPaths.inbox({ limit: 20, unread: true })).toBe("/v1/inbox?limit=20&unread=true");
    expect(restPaths.inboxRead()).toBe("/v1/inbox/read");
    expect(restPaths.claudeHook()).toBe("/v1/hooks/claude");
  });

  test("route patterns", () => {
    expect(routePatterns.rest.inbox).toBe("/v1/inbox");
    expect(routePatterns.rest.inboxRead).toBe("/v1/inbox/read");
    expect(routePatterns.rest.claudeHook).toBe("/v1/hooks/claude");
  });

  test("constants", () => {
    expect(ID_PREFIXES.inbox).toBe("inb_");
    expect(INBOX_KINDS).toEqual(["needs_input", "permission", "completed", "failed", "status", "file"]);
    expect(SERVER_EVENT_TYPES).toContain("inbox.updated");
    expect(LIMITS.defaultInboxList).toBeLessThanOrEqual(LIMITS.maxInboxList);
  });
});

describe("inbox schemas", () => {
  test("round-trips", () => {
    roundTrip(InboxItemSchema, sampleInboxItem);
    roundTrip(InboxSchema, sampleInbox);
    roundTrip(InboxCountsSchema, { unreadCount: 0, attentionCount: 0 });
    roundTrip(InboxSchema, { items: [], unreadCount: 0, attentionCount: 0 });
  });

  test("rejects malformed items", () => {
    rejects(InboxItemSchema, { ...sampleInboxItem, id: "run_123" });
    rejects(InboxItemSchema, { ...sampleInboxItem, kind: "question" });
    rejects(InboxItemSchema, { ...sampleInboxItem, terminalId: "prc_1" });
    rejects(InboxItemSchema, { ...sampleInboxItem, readAt: undefined });
    rejects(InboxSchema, { ...sampleInbox, unreadCount: -1 });
    rejects(InboxSchema, { items: sampleInbox.items });
  });

  test("query", () => {
    expect(InboxQuerySchema.parse({ limit: "25", unread: "1" })).toEqual({ limit: 25, unread: "1" });
    expect(InboxQuerySchema.parse({})).toEqual({});
    rejects(InboxQuerySchema, { limit: "0" });
    rejects(InboxQuerySchema, { limit: String(LIMITS.maxInboxList + 1) });
    rejects(InboxQuerySchema, { unread: "yes" });
  });

  test("mark read takes ids or all", () => {
    expect(MarkInboxReadSchema.parse({ ids: [sampleInboxItem.id] })).toEqual({ ids: [sampleInboxItem.id] });
    expect(MarkInboxReadSchema.parse({ all: true })).toEqual({ all: true });
    rejects(MarkInboxReadSchema, { ids: [] });
    rejects(MarkInboxReadSchema, { ids: ["bld_1"] });
    rejects(MarkInboxReadSchema, { all: false });
    rejects(MarkInboxReadSchema, {});
  });

  test("Claude hook payload keeps unknown fields", () => {
    const payload = {
      hook_event_name: "Stop",
      session_id: "abc",
      cwd: "/workspace/projects/app",
      last_assistant_message: "Done",
      stop_reason: "end_turn",
    };
    expect(ClaudeHookPayloadSchema.parse(payload)).toEqual(payload);
    rejects(ClaudeHookPayloadSchema, { session_id: "abc" });
    rejects(ClaudeHookPayloadSchema, { hook_event_name: "" });
    rejects(ClaudeHookPayloadSchema, { hook_event_name: "Notification", message: 3 });
  });

  test("inbox.updated event", () => {
    const event = { type: "inbox.updated" as const, item: sampleInboxItem, unreadCount: 1, attentionCount: 1 };
    expect(ServerEventSchema.parse(event)).toEqual(event);
    expect(ServerEventSchema.parse({ type: "inbox.updated", unreadCount: 0, attentionCount: 0 })).toEqual({
      type: "inbox.updated",
      unreadCount: 0,
      attentionCount: 0,
    });
    rejects(ServerEventSchema, { type: "inbox.updated", item: sampleInboxItem });
  });
});
