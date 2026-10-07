import { describe, expect, it } from "vitest";
import { actionFromDeepLink, commandFromDeepLink } from "./deep-link";

describe("actionFromDeepLink", () => {
  it("navigates to pages with their query params", () => {
    expect(actionFromDeepLink("monolith://agents?new=1")).toEqual({
      kind: "command",
      command: { type: "navigate", page: "agents", params: { new: true } },
    });
    expect(actionFromDeepLink("monolith:///projects")).toEqual({ kind: "command", command: { type: "navigate", page: "projects", params: {} } });
  });

  it("opens preferences sections", () => {
    expect(commandFromDeepLink("monolith://preferences/stt")).toEqual({ type: "preferences", section: "stt" });
    expect(commandFromDeepLink("monolith://settings?section=host-shell")).toEqual({ type: "preferences", section: "host-shell" });
    expect(commandFromDeepLink("monolith://preferences/unknown")).toEqual({ type: "preferences", section: undefined });
  });

  it("maps simple app actions", () => {
    expect(commandFromDeepLink("monolith://pair")).toEqual({ type: "pair" });
    expect(commandFromDeepLink("monolith://pair-host")).toEqual({ type: "pair-host" });
    expect(commandFromDeepLink("monolith://new-conversation")).toEqual({ type: "new-conversation" });
  });

  it("opens the setup wizard", () => {
    expect(actionFromDeepLink("monolith://onboarding/android")).toEqual({ kind: "onboarding", step: "android" });
    expect(actionFromDeepLink("monolith://setup")).toEqual({ kind: "onboarding", step: undefined });
  });

  it("shows the app for bare and unknown links and ignores query strings on simple actions", () => {
    expect(actionFromDeepLink("monolith://")).toEqual({ kind: "show" });
    expect(commandFromDeepLink("monolith://pair?url=https%3A%2F%2Fx")).toEqual({ type: "pair" });
    expect(actionFromDeepLink("monolith://whatever/else")).toEqual({ kind: "show" });
  });

  it("never forwards params that trigger actions", () => {
    expect(commandFromDeepLink("monolith://agents?prompt=rm%20-rf&send=1&projectId=p1&attachmentIds=a")).toEqual({
      type: "navigate",
      page: "agents",
      params: { prompt: "rm -rf" },
    });
    expect(commandFromDeepLink("monolith://files?artifactId=a1&view=builds")).toEqual({ type: "navigate", page: "files", params: { view: "builds" } });
    expect(commandFromDeepLink("monolith://terminals?kind=shell&projectId=p1")).toEqual({ type: "navigate", page: "terminals", params: {} });
    expect(commandFromDeepLink("monolith://overview?anything=1")).toEqual({ type: "navigate", page: "overview", params: {} });
  });

  it("parses flags and keeps safe page params", () => {
    expect(commandFromDeepLink("monolith://agents?search&new=0&runId=r1")).toEqual({
      type: "navigate",
      page: "agents",
      params: { search: true, runId: "r1" },
    });
    expect(commandFromDeepLink("monolith://projects?projectId=p1&tab=files")).toEqual({
      type: "navigate",
      page: "projects",
      params: { projectId: "p1", tab: "files" },
    });
  });

  it("rejects other schemes and garbage", () => {
    expect(actionFromDeepLink("https://agents")).toBeNull();
    expect(actionFromDeepLink("not a url")).toBeNull();
  });
});
