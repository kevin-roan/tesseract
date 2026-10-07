import { describe, expect, it } from "vitest";
import { canSubmitComposer, clampHeight, completeSlashCommand, isSubmitKey, matchSlashCommands, middleEllipsis, slashQuery, wrapIndex } from "./model";

describe("canSubmitComposer", () => {
  it("needs text or attachments", () => {
    expect(canSubmitComposer({ text: "  " })).toBe(false);
    expect(canSubmitComposer({ text: "hi" })).toBe(true);
    expect(canSubmitComposer({ text: "", hasAttachments: true })).toBe(true);
  });

  it("is blocked by busy, locked and pending attachments", () => {
    expect(canSubmitComposer({ text: "hi", busy: true })).toBe(false);
    expect(canSubmitComposer({ text: "hi", locked: true })).toBe(false);
    expect(canSubmitComposer({ text: "hi", hasAttachments: true, attachmentsBlocked: true })).toBe(false);
  });
});

describe("isSubmitKey", () => {
  it("submits on Enter and Ctrl+Enter but not Shift+Enter or IME", () => {
    expect(isSubmitKey({ key: "Enter", shiftKey: false })).toBe(true);
    expect(isSubmitKey({ key: "Enter", shiftKey: true })).toBe(false);
    expect(isSubmitKey({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
    expect(isSubmitKey({ key: "Enter", shiftKey: false, keyCode: 229 })).toBe(false);
    expect(isSubmitKey({ key: "a", shiftKey: false })).toBe(false);
  });
});

describe("slash commands", () => {
  const commands = [{ command: "review" }, { command: "/run" }, { command: "test" }];

  it("only matches a single leading slash token", () => {
    expect(slashQuery("/re")).toBe("re");
    expect(slashQuery("/re view")).toBeNull();
    expect(slashQuery("hello /re")).toBeNull();
  });

  it("filters by prefix and limits", () => {
    expect(matchSlashCommands("/r", commands, 8).map((c) => c.command)).toEqual(["review", "/run"]);
    expect(matchSlashCommands("/", commands, 2)).toHaveLength(2);
    expect(matchSlashCommands("r", commands, 8)).toEqual([]);
  });

  it("completes with a trailing space", () => {
    expect(completeSlashCommand({ command: "/run" })).toBe("/run ");
    expect(completeSlashCommand({ command: "test" })).toBe("/test ");
  });
});

describe("helpers", () => {
  it("clamps heights", () => {
    expect(clampHeight(10, 24, 200)).toBe(24);
    expect(clampHeight(500, 24, 200)).toBe(200);
    expect(clampHeight(80, 24, 200)).toBe(80);
  });

  it("wraps indices", () => {
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(1, 0)).toBe(0);
  });

  it("ellipsizes in the middle", () => {
    expect(middleEllipsis("short.txt", 22)).toBe("short.txt");
    const result = middleEllipsis("crash-report-2026-10-07.log", 22);
    expect(Array.from(result)).toHaveLength(22);
    expect(result.startsWith("crash-repor")).toBe(true);
    expect(result.endsWith("0-07.log")).toBe(true);
  });
});
