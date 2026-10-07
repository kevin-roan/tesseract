import type { TerminalInfo } from "@theone/protocol";
import { describe, expect, it } from "vitest";
import {
  bannerFor,
  connectionEmpty,
  estimateGrid,
  InputQueue,
  isCollapsed,
  keyCommand,
  mapSocketState,
  nextSelection,
  parseOpen,
  relativeTime,
  rowModel,
  runningCount,
  sessionSubtitle,
  sessionTitle,
  sidebarWidth,
  sortSessions,
  stateBadge,
  touchAttached,
  type KeyLike,
} from "./model";

const NOW = Date.parse("2026-10-07T12:00:00.000Z");
const HOUR = 3_600_000;

const info = (overrides: Partial<TerminalInfo> & Pick<TerminalInfo, "id">): TerminalInfo => ({
  kind: "shell",
  projectId: null,
  title: "bash",
  cwd: "/workspace",
  pid: 1,
  cols: 49,
  rows: 18,
  state: "running",
  exitCode: null,
  createdAt: new Date(NOW - 4 * HOUR).toISOString(),
  ...overrides,
});

const key = (overrides: Partial<KeyLike>): KeyLike => ({
  key: "",
  code: "",
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  type: "keydown",
  ...overrides,
});

describe("terminals model", () => {
  it("parses navigation params", () => {
    expect(parseOpen({ terminalId: "trm_1" })).toEqual({ type: "attach", terminalId: "trm_1" });
    expect(parseOpen({ kind: "claude", projectId: "monolith" })).toEqual({ type: "launch", kind: "claude", projectId: "monolith" });
    expect(parseOpen({ kind: "shell", projectId: "" })).toEqual({ type: "launch", kind: "shell", projectId: null });
    expect(parseOpen({ kind: "python" })).toBeNull();
    expect(parseOpen(null)).toBeNull();
  });

  it("sorts running sessions first, newest first", () => {
    const sorted = sortSessions([
      info({ id: "old", createdAt: "2026-10-01T00:00:00Z" }),
      info({ id: "ended", state: "exited", createdAt: "2026-10-07T00:00:00Z" }),
      info({ id: "new", createdAt: "2026-10-05T00:00:00Z" }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["new", "old", "ended"]);
    expect(runningCount(sorted)).toBe(2);
  });

  it("builds titles and subtitles like the GTK app", () => {
    const projects = [{ id: "streaxfit", name: "streaxfit" }] as never;
    expect(sessionTitle({ kind: "shell", projectId: null }, projects)).toBe("Shell · Workspace");
    expect(sessionTitle({ kind: "claude", projectId: "streaxfit" }, projects)).toBe("Claude Code · streaxfit");
    expect(sessionTitle({ kind: "python" as never, projectId: "other" }, projects)).toBe("Python · other");
    expect(sessionSubtitle(info({ id: "a" }), NOW)).toBe("started 4h ago · 49×18");
    expect(sessionSubtitle(info({ id: "b", state: "exited" }), NOW)).toBe("started 4h ago");
  });

  it("formats relative times", () => {
    expect(relativeTime(new Date(NOW - 10_000).toISOString(), NOW)).toBe("just now");
    expect(relativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5m ago");
    expect(relativeTime(new Date(NOW - 3 * 86_400_000).toISOString(), NOW)).toBe("3d ago");
    expect(relativeTime(new Date(NOW - 30 * 86_400_000).toISOString(), NOW)).toBe("2026-09-07");
    expect(relativeTime("", NOW)).toBe("");
  });

  it("uses live state for attached rows", () => {
    const row = rowModel(info({ id: "a" }), [], NOW, { state: "exited", exitCode: 2, error: null, title: null, cols: 0, rows: 0, hasSelection: false });
    expect(row).toMatchObject({ status: "Exited (2)", tone: "neutral", running: false, icon: "terminal" });
    expect(rowModel(info({ id: "b", kind: "claude" }), [], NOW)).toMatchObject({ status: "Running", tone: "success", running: true, icon: "agents" });
  });

  it("maps badges and banners", () => {
    expect(stateBadge("open")).toEqual({ label: "Live", tone: "success" });
    expect(stateBadge("reconnecting")).toEqual({ label: "Reconnecting…", tone: "warning" });
    expect(stateBadge("exited", null)).toEqual({ label: "Exited", tone: "neutral" });
    expect(bannerFor({ state: "exited", exitCode: 1, error: null })).toMatchObject({ tone: "danger", action: "restart", message: "The process exited with code 1." });
    expect(bannerFor({ state: "exited", exitCode: 0, error: null })).toMatchObject({ tone: "neutral" });
    expect(bannerFor({ state: "exited", exitCode: null, error: null })?.message).toBe("The process exited.");
    expect(bannerFor({ state: "closed", exitCode: null, error: null })?.message).toBe("The stream to this session closed.");
    expect(bannerFor({ state: "closed", exitCode: null, error: "boom" })).toMatchObject({ action: "reconnect", message: "The stream to this session closed. boom" });
    expect(bannerFor({ state: "reconnecting", exitCode: null, error: null })).toMatchObject({ tone: "warning", action: null });
    expect(bannerFor({ state: "open", exitCode: null, error: null })).toBeNull();
  });

  it("maps socket states", () => {
    expect(mapSocketState("connecting", false)).toBe("connecting");
    expect(mapSocketState("connecting", true)).toBe("reconnecting");
    expect(mapSocketState("open", true)).toBe("open");
    expect(mapSocketState("closed", true)).toBe("closed");
  });

  it("sizes the split", () => {
    expect(isCollapsed(560)).toBe(true);
    expect(isCollapsed(561)).toBe(false);
    expect(isCollapsed(null)).toBe(false);
    expect(sidebarWidth(770)).toBe(300);
    expect(sidebarWidth(561)).toBe(281);
    expect(sidebarWidth(400)).toBe(240);
  });

  it("estimates the grid with a fallback", () => {
    expect(estimateGrid(0, 0)).toEqual({ cols: 100, rows: 30 });
    expect(estimateGrid(860, 500)).toEqual({ cols: 100, rows: 30 });
  });

  it("picks the next attached session after a removal", () => {
    expect(nextSelection(["a", "b", "c"], ["a", "c"], "b")).toBe("c");
    expect(nextSelection(["a", "b", "c"], ["a", "b"], "c")).toBe("b");
    expect(nextSelection(["a"], ["a"], "a")).toBeNull();
  });

  it("evicts the least recently used session but never the current one", () => {
    expect(touchAttached(["a", "b", "c"], "d", "a", 3)).toEqual({ order: ["a", "c", "d"], evicted: ["b"] });
    expect(touchAttached(["a", "b"], "a", null, 6)).toEqual({ order: ["b", "a"], evicted: [] });
  });

  it("describes the connection empty states", () => {
    expect(connectionEmpty("online", null)).toBeNull();
    expect(connectionEmpty("offline", "ECONNREFUSED")).toMatchObject({ title: "Sandbox unreachable", message: "ECONNREFUSED", action: "retry", icon: "offline" });
    expect(connectionEmpty("connecting", null)).toMatchObject({ loading: true, message: null });
    expect(connectionEmpty("unconfigured", null)).toMatchObject({ action: "preferences", icon: "sandbox" });
  });

  it("maps terminal shortcuts", () => {
    expect(keyCommand(key({ key: "C", ctrlKey: true, shiftKey: true }))).toBe("copy");
    expect(keyCommand(key({ key: "V", ctrlKey: true, shiftKey: true }))).toBe("paste");
    expect(keyCommand(key({ key: "c", ctrlKey: true }))).toBeNull();
    expect(keyCommand(key({ key: "PageUp", shiftKey: true }))).toBe("pageUp");
    expect(keyCommand(key({ key: "Home", ctrlKey: true, shiftKey: true }))).toBe("scrollTop");
    expect(keyCommand(key({ key: "=", ctrlKey: true }))).toBe("zoomIn");
    expect(keyCommand(key({ key: "-", ctrlKey: true }))).toBe("zoomOut");
    expect(keyCommand(key({ key: "0", ctrlKey: true }))).toBe("zoomReset");
    expect(keyCommand(key({ key: ")", code: "Digit0", ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(keyCommand(key({ key: "Enter", shiftKey: true }))).toBe("shiftEnter");
    expect(keyCommand(key({ key: "Enter", shiftKey: true, type: "keyup" }))).toBeNull();
  });

  it("caps queued input", () => {
    const queue = new InputQueue(5);
    expect(queue.push("abc")).toBe(true);
    expect(queue.push("def")).toBe(false);
    expect(queue.push("de")).toBe(true);
    expect(queue.drain()).toEqual(["abc", "de"]);
    expect(queue.length).toBe(0);
  });
});
