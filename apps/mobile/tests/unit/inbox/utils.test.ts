import type { InboxItem } from "@tesseract/protocol";
import { sampleInboxItem } from "@tesseract/protocol/fixtures";

import {
  ALL_INBOX_PROJECTS,
  attentionTitle,
  filterInboxByProject,
  groupInbox,
  inboxProjectOptions,
  inboxTarget,
  isAttentionKind,
  markItemsRead,
  needsAttention,
  upsertInboxItem,
} from "@/features/inbox/utils/group";
import { inboxKindMeta } from "@/features/inbox/utils/kinds";
import {
  isRemoteTrigger,
  notificationData,
  notificationKey,
  parseNotificationData,
  pushDeviceName,
  shouldNotify,
  shouldPresent,
} from "@/features/inbox/utils/notify";

const item = (overrides: Partial<InboxItem>): InboxItem => ({ ...sampleInboxItem, ...overrides });

const permission = item({ id: "inb_perm", kind: "permission", updatedAt: "2026-09-23T10:05:00.000Z" });
const question = item({ id: "inb_ask", kind: "needs_input", updatedAt: "2026-09-23T10:06:00.000Z" });
const finished = item({ id: "inb_done", kind: "completed", updatedAt: "2026-09-23T10:07:00.000Z" });
const readQuestion = item({ id: "inb_old", kind: "needs_input", readAt: "2026-09-23T10:08:00.000Z", updatedAt: "2026-09-23T09:00:00.000Z" });
const failed = item({ id: "inb_fail", kind: "failed", readAt: "2026-09-23T10:08:00.000Z", updatedAt: "2026-09-23T09:30:00.000Z" });

describe("groupInbox", () => {
  it("puts unread questions and permissions first, then unread, then earlier, newest first", () => {
    const sections = groupInbox([readQuestion, permission, finished, failed, question]);
    expect(sections.map((section) => [section.title, section.items.map((entry) => entry.id)])).toEqual([
      ["Needs you", ["inb_ask", "inb_perm"]],
      ["Unread", ["inb_done"]],
      ["Earlier", ["inb_fail", "inb_old"]],
    ]);
  });

  it("drops empty sections", () => {
    expect(groupInbox([finished]).map((section) => section.id)).toEqual(["unread"]);
    expect(groupInbox([])).toEqual([]);
  });
});

describe("project filter", () => {
  const beta = item({ id: "inb_beta", projectId: "beta" });
  const alpha = item({ id: "inb_alpha", projectId: "alpha" });
  const loose = item({ id: "inb_loose", projectId: null });
  const names = new Map([["alpha", "Zeta app"]]);

  it("offers All plus each project by name, only when there is a choice", () => {
    expect(inboxProjectOptions([beta, alpha, loose, alpha], names)).toEqual([
      { value: ALL_INBOX_PROJECTS, label: "All" },
      { value: "beta", label: "beta" },
      { value: "alpha", label: "Zeta app" },
    ]);
    expect(inboxProjectOptions([alpha, loose], names)).toEqual([]);
  });

  it("keeps every item for All and only that project's items otherwise", () => {
    expect(filterInboxByProject([beta, alpha, loose], ALL_INBOX_PROJECTS)).toEqual([beta, alpha, loose]);
    expect(filterInboxByProject([beta, alpha, loose], "alpha")).toEqual([alpha]);
  });
});

describe("inbox item helpers", () => {
  it("flags attention kinds only while unread", () => {
    expect(isAttentionKind("permission")).toBe(true);
    expect(isAttentionKind("completed")).toBe(false);
    expect(needsAttention(question)).toBe(true);
    expect(needsAttention(readQuestion)).toBe(false);
  });

  it("replaces an item by id and keeps the newest first", () => {
    const updated = { ...permission, updatedAt: "2026-09-23T11:00:00.000Z" };
    expect(upsertInboxItem([finished, permission], updated).map((entry) => entry.id)).toEqual(["inb_perm", "inb_done"]);
  });

  it("marks selected or all unread items read without touching read ones", () => {
    const at = "2026-09-24T00:00:00.000Z";
    const some = markItemsRead([permission, finished, readQuestion], ["inb_perm"], at);
    expect(some.map((entry) => entry.readAt)).toEqual([at, null, readQuestion.readAt]);
    const all = markItemsRead([permission, finished, readQuestion], "all", at);
    expect(all.map((entry) => entry.readAt)).toEqual([at, at, readQuestion.readAt]);
  });

  it("links to the shared file, then the run, then the terminal, then the chat, then the project", () => {
    const base = { artifactId: null, agentRunId: null, terminalId: null, sessionId: null, projectId: null };
    expect(inboxTarget({ ...base, artifactId: "art_1", agentRunId: "run_1" })).toEqual({ kind: "file", id: "art_1" });
    expect(inboxTarget({ ...base, agentRunId: "run_1", terminalId: "trm_1" })).toEqual({ kind: "agentRun", id: "run_1" });
    expect(inboxTarget({ ...base, terminalId: "trm_1", sessionId: "s" })).toEqual({ kind: "terminal", id: "trm_1" });
    expect(inboxTarget({ ...base, sessionId: "s", projectId: "p" })).toEqual({ kind: "chat", id: "s" });
    expect(inboxTarget({ ...base, projectId: "p" })).toEqual({ kind: "project", id: "p" });
    expect(inboxTarget(base)).toBeNull();
  });

  it("describes each kind", () => {
    expect(inboxKindMeta("failed").tone).toBe("danger");
    expect(inboxKindMeta("needs_input").tone).toBe("warning");
    expect(inboxKindMeta("completed").label).toBe("Finished");
    expect(inboxKindMeta("file").label).toBe("Shared a file");
  });

  it("titles the attention banner", () => {
    expect(attentionTitle(0)).toBeNull();
    expect(attentionTitle(1)).toBe("1 request needs you");
    expect(attentionTitle(3)).toBe("3 requests need you");
  });
});

describe("shouldNotify", () => {
  const context = { appState: "active", pathname: "/", seen: new Set<string>() };

  it("notifies for unread attention items outside the inbox while the app is active", () => {
    expect(shouldNotify(permission, context)).toBe(true);
  });

  it("leaves the background to remote pushes", () => {
    expect(shouldNotify(permission, { ...context, appState: "background" })).toBe(false);
    expect(shouldNotify(permission, { ...context, appState: "inactive" })).toBe(false);
  });

  it("notifies for unread finished and failed runs", () => {
    expect(shouldNotify(finished, context)).toBe(true);
    expect(shouldNotify({ ...failed, readAt: null }, context)).toBe(true);
    expect(shouldNotify(failed, context)).toBe(false);
  });

  it("stays quiet on the inbox screen, for read items and for repeats", () => {
    expect(shouldNotify(permission, { ...context, pathname: "/inbox" })).toBe(false);
    expect(shouldNotify(finished, { ...context, pathname: "/inbox" })).toBe(false);
    expect(shouldNotify(readQuestion, context)).toBe(false);
    expect(shouldNotify(undefined, context)).toBe(false);
    expect(shouldNotify(permission, { ...context, seen: new Set([notificationKey(permission)]) })).toBe(false);
  });

  it("notifies once for unread shared files", () => {
    const file = item({ id: "inb_file", kind: "file", artifactId: "art_1", readAt: null });
    expect(shouldNotify(file, context)).toBe(true);
    expect(shouldNotify({ ...file, readAt: "2026-09-23T10:09:00.000Z" }, context)).toBe(false);
    expect(shouldNotify(file, { ...context, seen: new Set([notificationKey(file)]) })).toBe(false);
  });
});

describe("shouldPresent", () => {
  const base = { remote: true, appState: "background", itemId: "inb_1", presented: new Set<string>() };

  it("always shows local notifications", () => {
    expect(shouldPresent({ ...base, remote: false, appState: "active" })).toBe(true);
  });

  it("hides remote pushes while active or when the item was already shown locally", () => {
    expect(shouldPresent(base)).toBe(true);
    expect(shouldPresent({ ...base, appState: "active" })).toBe(false);
    expect(shouldPresent({ ...base, presented: new Set(["inb_1"]) })).toBe(false);
    expect(shouldPresent({ ...base, itemId: null, presented: new Set(["inb_1"]) })).toBe(true);
  });

  it("recognises push triggers", () => {
    expect(isRemoteTrigger({ type: "push" })).toBe(true);
    expect(isRemoteTrigger({ channelId: "inbox" })).toBe(false);
    expect(isRemoteTrigger(null)).toBe(false);
  });
});

describe("notification data", () => {
  const data = { url: "/inbox", sandboxId: "sbx_1", itemId: "inb_1", kind: "file", artifactId: "art_1" };

  it("parses push data and rejects anything else", () => {
    expect(parseNotificationData(data)).toEqual(data);
    expect(parseNotificationData({ ...data, artifactId: null })?.artifactId).toBeNull();
    expect(parseNotificationData({ ...data, url: "/other" })).toBeNull();
    expect(parseNotificationData({ url: "/inbox" })).toBeNull();
    expect(parseNotificationData(null)).toBeNull();
  });

  it("builds local notification data in the push shape", () => {
    const built = notificationData(permission, "sbx_1");
    expect(built).toEqual({ url: "/inbox", sandboxId: "sbx_1", itemId: permission.id, kind: "permission", artifactId: null });
    expect(parseNotificationData(built)).toEqual(built);
  });

  it("normalises the device name", () => {
    expect(pushDeviceName("  Pixel  ")).toBe("Pixel");
    expect(pushDeviceName("   ")).toBeNull();
    expect(pushDeviceName(null)).toBeNull();
    expect(pushDeviceName("x".repeat(200))).toHaveLength(128);
  });
});
