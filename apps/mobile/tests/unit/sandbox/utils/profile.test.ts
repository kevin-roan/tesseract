import type { AgentRun, BuildJob, ProcessInfo } from "@tesseract/protocol";
import { sampleAgentRun, sampleBuild, sampleProcess, sampleProject, sampleStatus } from "@tesseract/protocol/fixtures";

import {
  activityActor,
  activityFeed,
  isTailscaleIdentityMissing,
  profilePerson,
  profileStats,
  profileView,
} from "@/features/sandbox/utils/profile";

import { NO_TAILSCALE, TEST_IDENTITY, TEST_SANDBOX } from "../helpers";

const NOW = Date.parse("2026-09-23T11:00:00.000Z");
const actor = { name: "Ada Lovelace", photo: "https://example.com/ada.png" };

describe("profileView", () => {
  it("prefers the viewer and shows login, sandbox node and tailnet", () => {
    expect(profileView(TEST_IDENTITY, TEST_SANDBOX, sampleStatus)).toEqual({
      name: "Ada Lovelace",
      tagline: "ada@example.com · tesseract-sandbox.tail1234.ts.net",
      team: "example.com",
      photo: "https://example.com/ada.png",
    });
  });

  it("falls back to the owner when the viewer is unknown", () => {
    const identity = { ...TEST_IDENTITY, tailscale: { ...TEST_IDENTITY.tailscale, viewer: null, node: null } };
    expect(profilePerson(identity)?.displayName).toBe("Grace Hopper");
    expect(profileView(identity, TEST_SANDBOX, sampleStatus)).toEqual({
      name: "Grace Hopper",
      tagline: `grace@example.com · ${sampleStatus.hostname}`,
      team: "example.com",
      photo: undefined,
    });
  });

  it("uses the sandbox when Tailscale shares nothing", () => {
    expect(profileView(NO_TAILSCALE, TEST_SANDBOX)).toEqual({
      name: TEST_SANDBOX.name,
      tagline: TEST_SANDBOX.baseUrl,
      team: undefined,
      photo: undefined,
    });
    expect(profileView(undefined, TEST_SANDBOX, sampleStatus).tagline).toBe(sampleStatus.hostname);
    expect(activityActor(undefined, TEST_SANDBOX)).toEqual({ name: TEST_SANDBOX.name, photo: undefined });
    expect(activityActor(TEST_IDENTITY, TEST_SANDBOX)).toEqual(actor);
  });
});

describe("isTailscaleIdentityMissing", () => {
  it("is only true once the identity says so", () => {
    expect(isTailscaleIdentityMissing(undefined)).toBe(false);
    expect(isTailscaleIdentityMissing(TEST_IDENTITY)).toBe(false);
    expect(isTailscaleIdentityMissing(NO_TAILSCALE)).toBe(true);
    const nobody = { ...TEST_IDENTITY, tailscale: { ...TEST_IDENTITY.tailscale, viewer: null, owner: null } };
    expect(isTailscaleIdentityMissing(nobody)).toBe(true);
  });
});

describe("profileStats", () => {
  it("reads the status counts and shows dashes before it loads", () => {
    expect(profileStats(sampleStatus).map((stat) => [stat.label, stat.value])).toEqual([
      ["Projects", "2"],
      ["Running", "1"],
      ["Builds", "1"],
    ]);
    expect(profileStats(undefined).map((stat) => stat.value)).toEqual(["—", "—", "—"]);
  });
});

describe("activityFeed", () => {
  const build: BuildJob = { ...sampleBuild, endedAt: "2026-09-23T10:30:00.000Z" };
  const run: AgentRun = { ...sampleAgentRun, startedAt: "2026-09-23T10:50:00.000Z", projectId: null };
  const process: ProcessInfo = { ...sampleProcess, port: 5173, startedAt: "2026-09-23T10:10:00.000Z" };

  it("merges builds, runs and processes newest first with metrics", () => {
    const feed = activityFeed(
      { builds: [build], runs: [run], processes: [process], projects: [{ ...sampleProject, name: "Hello" }] },
      actor,
      NOW,
    );

    expect(feed.map((entry) => entry.id)).toEqual([`run-${run.id}`, `build-${build.id}`, `process-${process.id}`]);
    expect(feed.map((entry) => entry.ref)).toEqual([
      { kind: "run", id: run.id },
      { kind: "build", id: build.id },
      { kind: "process", id: process.id, projectId: process.projectId },
    ]);
    expect(feed[0].item).toMatchObject({
      actor: "Ada Lovelace",
      photo: actor.photo,
      action: "is running Claude in",
      target: "the sandbox",
      timeAgo: "10m ago",
    });
    expect(feed[0].item.metrics?.map((metric) => metric.value)).toEqual(["Running", "—", "10m"]);
    expect(feed[1].item).toMatchObject({ action: "built Windows installer for", target: "Hello", timeAgo: "30m ago" });
    expect(feed[1].item.metrics?.map((metric) => metric.value)).toEqual(["Succeeded", "100%", "1"]);
    expect(feed[2].item).toMatchObject({ action: "is running", target: "dev in Hello" });
    expect(feed[2].item.metrics?.map((metric) => metric.value)).toEqual(["Running", "5173", String(process.pid)]);
  });

  it("describes finished work, unknown projects and caps the list", () => {
    const feed = activityFeed(
      {
        builds: [{ ...sampleBuild, state: "queued", progress: null, startedAt: null, endedAt: null, projectId: "gone" }],
        runs: [{ ...sampleAgentRun, state: "failed", usage: { inputTokens: 8000, outputTokens: 4300, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 12_300 }, endedAt: "2026-09-23T10:06:00.000Z" }],
        processes: [{ ...sampleProcess, state: "stopped", projectId: null, endedAt: "2026-09-23T10:07:00.000Z" }],
      },
      actor,
      NOW,
      2,
    );

    expect(feed).toHaveLength(2);
    expect(feed[0].item).toMatchObject({ action: "stopped", target: "dev" });
    expect(feed[0].item.metrics?.[1].value).toBe("—");
    expect(feed[1].item).toMatchObject({ action: "had a failed Claude run in", target: sampleAgentRun.projectId });
    expect(feed[1].item.metrics?.map((metric) => metric.value)).toEqual(["Failed", "12.3k", "6m"]);

    const [queued] = activityFeed({ builds: [{ ...sampleBuild, state: "queued", progress: null, projectId: "gone" }] }, actor, NOW);
    expect(queued.item).toMatchObject({ action: "queued Windows installer for", target: "gone" });
    expect(queued.item.metrics?.[1].value).toBe("—");
    expect(activityFeed({}, actor, NOW)).toEqual([]);
  });
});
