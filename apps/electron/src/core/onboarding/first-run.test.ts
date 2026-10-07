import { describe, expect, it } from "vitest";
import { decideFirstRun } from "./index";

describe("first run", () => {
  it("opens the wizard on an empty profile", () => {
    expect(decideFirstRun({}, {})).toEqual({ open: true, step: "welcome" });
  });

  it("resumes at the saved step", () => {
    expect(decideFirstRun({ onboarding: { step: "build", statuses: {} } }, {})).toEqual({ open: true, step: "build" });
  });

  it("skips the wizard when completed, configured or discovered", () => {
    expect(decideFirstRun({ onboarding: { completedAt: "2026-10-06T00:00:00Z" } }, {}).open).toBe(false);
    expect(decideFirstRun({ url: "http://127.0.0.1:7700", token: "t" }, {}).open).toBe(false);
    expect(decideFirstRun({}, {}, true).open).toBe(false);
  });
});
