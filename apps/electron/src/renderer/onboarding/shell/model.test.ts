import { describe, expect, it } from "vitest";
import { adjacentStep, directionBetween, firstUnfinishedRequired, railItems, resolveStatus, stepPosition, type RailStep } from "./model";

const STEPS: RailStep[] = [
  { id: "welcome", railLabel: "Welcome", optional: false },
  { id: "docker", railLabel: "Docker", optional: false },
  { id: "claude", railLabel: "Claude Code", optional: false },
  { id: "android", railLabel: "Android emulator", optional: true },
  { id: "finish", railLabel: "Done", optional: false },
];

describe("resolveStatus", () => {
  it("marks the current pending step active and demotes stale active steps", () => {
    expect(resolveStatus("docker", "docker", {}, {})).toBe("active");
    expect(resolveStatus("welcome", "docker", { welcome: "active" }, {})).toBe("pending");
  });

  it("prefers renderer overrides over the main-process status", () => {
    expect(resolveStatus("docker", "docker", { docker: "pending" }, { docker: "running" })).toBe("running");
  });
});

describe("railItems", () => {
  it("locks steps after the first unfinished required step", () => {
    const items = railItems(STEPS, "welcome", {});
    expect(items.map((item) => item.clickable)).toEqual([true, false, false, false, false]);
    expect(items[0]).toMatchObject({ current: true, status: "active" });
  });

  it("unlocks finished steps and the next required one", () => {
    const items = railItems(STEPS, "claude", { welcome: "done", docker: "warning" });
    expect(items.map((item) => item.clickable)).toEqual([true, true, true, false, false]);
    expect(items.map((item) => item.status)).toEqual(["done", "warning", "active", "pending", "pending"]);
  });

  it("keeps skipped and failed steps clickable", () => {
    const items = railItems(STEPS, "welcome", { android: "skipped", finish: "error" });
    expect(items[3]?.clickable).toBe(true);
    expect(items[4]?.clickable).toBe(true);
  });

  it("ignores optional steps when looking for the first unfinished step", () => {
    const status = (id: string) => (id === "android" ? "pending" : "done");
    expect(firstUnfinishedRequired(STEPS, status as never)).toBe(STEPS.length - 1);
  });
});

describe("navigation helpers", () => {
  it("finds positions and neighbours", () => {
    expect(stepPosition(STEPS, "claude")).toEqual({ index: 2, total: 5 });
    expect(adjacentStep(STEPS, "claude", 1)).toBe("android");
    expect(adjacentStep(STEPS, "welcome", -1)).toBeNull();
  });

  it("computes the transition direction", () => {
    expect(directionBetween(1, 3, -1)).toBe(1);
    expect(directionBetween(3, 1, 1)).toBe(-1);
    expect(directionBetween(2, 2, -1)).toBe(-1);
  });
});
