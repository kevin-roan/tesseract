import type { AgentRun, ClaudeSession, InboxItem } from "@tesseract/protocol";
import { describe, expect, it, vi } from "vitest";
import { buildNotices, followUpState, headerActions, lockedReason, menuSections, noticeItemsForRun, terminalForRun } from "./model";

const TS = "2026-10-07T10:00:00.000Z";

const run = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  id: "run_a",
  projectId: "tesseract",
  prompt: "p",
  mode: null,
  attachments: [],
  sessionId: "s1",
  claudeAccountId: null,
  state: "succeeded",
  startedAt: TS,
  endedAt: TS,
  usage: null,
  result: null,
  error: null,
  archivedAt: null,
  ...overrides,
});

const inbox = (overrides: Partial<InboxItem>): InboxItem => ({
  id: "inb_1",
  kind: "needs_input",
  title: "Claude needs input",
  body: "Pick a branch",
  projectId: null,
  sessionId: null,
  agentRunId: null,
  terminalId: null,
  artifactId: null,
  createdAt: TS,
  updatedAt: TS,
  readAt: null,
  ...overrides,
});

const session = (overrides: Partial<ClaudeSession>): ClaudeSession =>
  ({ sessionId: "s1", terminalId: null, active: true, source: "terminal", ...overrides }) as ClaudeSession;

describe("follow-up state", () => {
  it("locks running runs and runs without a session", () => {
    expect(followUpState(null)).toBe("running");
    expect(followUpState(run({ state: "running" }))).toBe("running");
    expect(followUpState(run({ sessionId: null }))).toBe("no_session");
    expect(followUpState(run())).toBe("ready");
    expect(lockedReason("running")).toBe("Claude is still working. You can reply when this run ends.");
    expect(lockedReason("ready")).toBeNull();
  });
});

describe("header actions", () => {
  it("follows the run state", () => {
    expect(headerActions(run({ state: "running" }), [])).toEqual({ stop: true, terminalId: null, sync: true, archive: false, unarchive: false });
    expect(headerActions(run({ archivedAt: TS, projectId: null }), [])).toMatchObject({ stop: false, sync: false, archive: false, unarchive: true });
    expect(terminalForRun(run(), [session({ terminalId: "trm_1" })])).toBe("trm_1");
    expect(terminalForRun(run({ sessionId: null }), [session({ terminalId: "trm_1" })])).toBeNull();
  });

  it("builds the more menu sections", () => {
    const handlers = { copySession: vi.fn(), reload: vi.fn(), discard: vi.fn(), remove: vi.fn() };
    const labels = (sections: ReturnType<typeof menuSections>) => sections.map((section) => section.map((entry) => entry.label));
    expect(labels(menuSections(run(), handlers))).toEqual([["Copy session id", "Reload"], ["Discard changes", "Delete…"]]);
    expect(labels(menuSections(run({ state: "running", sessionId: null, projectId: null }), { ...handlers, discard: null }))).toEqual([[], []]);
    expect(menuSections(null, handlers)).toEqual([]);
  });
});

describe("notices", () => {
  it("orders link, error, sync and inbox notices", () => {
    const handlers = { dismissError: vi.fn(), dismissSync: vi.fn(), openItem: vi.fn(), markRead: vi.fn() };
    const file = inbox({ id: "inb_2", kind: "file", artifactId: "art_1", title: "build.apk" });
    const notices = buildNotices(
      { link: "reconnecting", error: "boom", syncReport: { message: "Synced", tone: "success" }, items: [inbox({}), file] },
      handlers,
    );
    expect(notices.map((notice) => [notice.key, notice.tone, notice.actionLabel])).toEqual([
      ["link", "warning", undefined],
      ["error", "danger", "Dismiss"],
      ["sync", "success", "Dismiss"],
      ["item-inb_1", "warning", "Mark as read"],
      ["item-inb_2", "info", "Download"],
    ]);
    notices[4]?.onAction?.();
    expect(handlers.openItem).toHaveBeenCalledWith(file);
    expect(buildNotices({ link: "polling", error: null, syncReport: null, items: [] }, handlers)[0]?.message).toBe(
      "Live output unavailable here; refreshing every few seconds.",
    );
  });

  it("matches inbox items to the run", () => {
    const items = [
      inbox({ id: "inb_1", agentRunId: "run_a" }),
      inbox({ id: "inb_2", sessionId: "s1" }),
      inbox({ id: "inb_3", sessionId: "s1", agentRunId: "run_b" }),
      inbox({ id: "inb_4", agentRunId: "run_a", readAt: TS }),
      inbox({ id: "inb_5", agentRunId: "run_a", kind: "completed" }),
      inbox({ id: "inb_6", agentRunId: "run_a", kind: "file" }),
    ];
    expect(noticeItemsForRun(run(), items).map((item) => item.id)).toEqual(["inb_1", "inb_2"]);
    expect(noticeItemsForRun(null, items)).toEqual([]);
  });
});
