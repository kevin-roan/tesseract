import type { TerminalInfo } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { clampPanelSize, panelBounds, panelTabs } from "./panel-model";

const info = (id: string, overrides: Partial<TerminalInfo>): TerminalInfo => ({
  id,
  kind: "shell",
  projectId: "p1",
  title: "",
  cwd: "",
  pid: null,
  cols: 0,
  rows: 0,
  state: "running",
  exitCode: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("panelTabs", () => {
  it("keeps only this project's running sessions, oldest first, numbering repeats", () => {
    const tabs = panelTabs(
      [
        info("late", { createdAt: "2026-01-03T00:00:00.000Z" }),
        info("early", { createdAt: "2026-01-02T00:00:00.000Z" }),
        info("claude", { kind: "claude" }),
        info("other", { projectId: "p2" }),
        info("done", { state: "exited" }),
      ],
      "p1",
    );
    expect(tabs.map((tab) => [tab.id, tab.label])).toEqual([
      ["claude", "Claude Code"],
      ["early", "Shell"],
      ["late", "Shell 2"],
    ]);
  });

  it("is empty until the list has loaded", () => {
    expect(panelTabs(null, "p1")).toEqual([]);
  });
});

describe("panel sizing", () => {
  it("leaves room for the page content", () => {
    expect(panelBounds("bottom", 800)).toEqual({ min: 140, max: 640 });
    expect(panelBounds("right", 1000)).toEqual({ min: 280, max: 680 });
  });

  it("never drops the maximum below the minimum in a cramped window", () => {
    expect(panelBounds("right", 400)).toEqual({ min: 280, max: 280 });
  });

  it("clamps a stored size to the current bounds", () => {
    expect(clampPanelSize(900, { min: 140, max: 640 })).toBe(640);
    expect(clampPanelSize(20, { min: 140, max: 640 })).toBe(140);
  });
});
