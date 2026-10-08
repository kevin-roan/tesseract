import { describe, expect, it } from "vitest";
import { actionFromDeepLink, commandFromDeepLink } from "./deep-link";

describe("actionFromDeepLink", () => {
  it("navigates to pages with their query params", () => {
    expect(actionFromDeepLink("tesseract://agents?new=1")).toEqual({
      kind: "command",
      command: { type: "navigate", page: "agents", params: { new: true } },
    });
    expect(actionFromDeepLink("tesseract:///projects")).toEqual({ kind: "command", command: { type: "navigate", page: "projects", params: {} } });
  });

  it("opens preferences sections", () => {
    expect(commandFromDeepLink("tesseract://preferences/stt")).toEqual({ type: "preferences", section: "stt" });
    expect(commandFromDeepLink("tesseract://settings?section=host-shell")).toEqual({ type: "preferences", section: "host-shell" });
    expect(commandFromDeepLink("tesseract://preferences/unknown")).toEqual({ type: "preferences", section: undefined });
  });

  it("maps simple app actions", () => {
    expect(commandFromDeepLink("tesseract://pair")).toEqual({ type: "pair" });
    expect(commandFromDeepLink("tesseract://pair-host")).toEqual({ type: "pair-host" });
    expect(commandFromDeepLink("tesseract://new-conversation")).toEqual({ type: "new-conversation" });
  });

  it("opens the setup wizard", () => {
    expect(actionFromDeepLink("tesseract://onboarding/android")).toEqual({ kind: "onboarding", step: "android" });
    expect(actionFromDeepLink("tesseract://setup")).toEqual({ kind: "onboarding", step: undefined });
  });

  it("shows the app for bare and unknown links and ignores query strings on simple actions", () => {
    expect(actionFromDeepLink("tesseract://")).toEqual({ kind: "show" });
    expect(commandFromDeepLink("tesseract://pair?url=https%3A%2F%2Fx")).toEqual({ type: "pair" });
    expect(actionFromDeepLink("tesseract://whatever/else")).toEqual({ kind: "show" });
  });

  it("never forwards params that trigger actions", () => {
    expect(commandFromDeepLink("tesseract://agents?prompt=rm%20-rf&send=1&projectId=p1&attachmentIds=a")).toEqual({
      type: "navigate",
      page: "agents",
      params: { prompt: "rm -rf" },
    });
    expect(commandFromDeepLink("tesseract://files?artifactId=a1&view=builds")).toEqual({ type: "navigate", page: "files", params: { view: "builds" } });
    expect(commandFromDeepLink("tesseract://terminals?kind=shell&projectId=p1")).toEqual({ type: "navigate", page: "terminals", params: {} });
    expect(commandFromDeepLink("tesseract://overview?anything=1")).toEqual({ type: "navigate", page: "overview", params: {} });
  });

  it("parses flags and keeps safe page params", () => {
    expect(commandFromDeepLink("tesseract://agents?search&new=0&runId=r1")).toEqual({
      type: "navigate",
      page: "agents",
      params: { search: true, runId: "r1" },
    });
    expect(commandFromDeepLink("tesseract://projects?projectId=p1&tab=files")).toEqual({
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
