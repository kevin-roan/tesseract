import { describe, expect, it } from "vitest";
import { claudeAccount, fixtureOnboardingState } from "../../fixtures/onboarding-final/data";
import { summarize, summaryStatus } from "./model";

describe("summarize", () => {
  it("summarizes a complete setup", () => {
    const items = summarize(fixtureOnboardingState());
    expect(items.map((item) => [item.id, item.detail, item.status])).toEqual([
      ["docker", "Docker Engine 29.8.1", "done"],
      ["claude", "Signed in as you@example.com", "done"],
      ["sandbox", "theone-sandbox · https://theone-sandbox.tail1234.ts.net", "done"],
      ["android", "Monolith_API_36", "done"],
      ["pair", "Pairing link ready", "done"],
    ]);
  });

  it("marks skipped optional steps and missing logins", () => {
    const state = fixtureOnboardingState({
      statuses: {
        ...fixtureOnboardingState().statuses,
        claude: "warning",
        android: "skipped",
        pair: "skipped",
      },
      claude: [claudeAccount({ login: "missing" })],
      android: { kind: "idle" },
    });
    const items = Object.fromEntries(summarize(state).map((item) => [item.id, item]));
    expect(items.claude).toMatchObject({
      detail: "Not signed in",
      status: "warning",
    });
    expect(items.android).toMatchObject({
      detail: "Skipped",
      status: "skipped",
    });
    expect(items.pair).toMatchObject({ detail: "Skipped", status: "skipped" });
  });

  it("handles a missing state and unbuilt sandbox", () => {
    expect(summarize(null).every((item) => item.status === "pending")).toBe(true);
    const items = summarize(
      fixtureOnboardingState({
        pair: null,
        build: { kind: "idle" },
        docker: null,
      }),
    );
    expect(items[0]?.detail).toBe(items[0]?.status === "done" ? "Ready" : "Not checked");
    expect(items[2]?.detail).toBe("Not built yet");
  });

  it("describes docker without a report by its recorded status", () => {
    const base = fixtureOnboardingState({ docker: null });
    const done = summarize({ ...base, statuses: { ...base.statuses, docker: "done" } });
    const pending = summarize({ ...base, statuses: { ...base.statuses, docker: "pending" } });
    expect(done[0]).toMatchObject({ detail: "Ready", status: "done" });
    expect(pending[0]).toMatchObject({ detail: "Not checked", status: "pending" });
  });

  it("maps step statuses", () => {
    expect(summaryStatus("running")).toBe("pending");
    expect(summaryStatus("active")).toBe("pending");
    expect(summaryStatus("error")).toBe("error");
  });
});
