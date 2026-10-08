import type { BuildJob } from "@tesseract/protocol";
import { sampleArtifact, sampleBuild } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { buildMeta, buildProgress, buildStatus, cancelBody, targetSubtitle } from "./model";

const NOW = Date.parse("2026-09-23T12:00:00Z");
const build = (patch: Partial<BuildJob>): BuildJob => ({ ...sampleBuild, ...patch });

describe("builds model", () => {
  it("builds target subtitles", () => {
    expect(targetSubtitle("electron-windows")).toBe("Electron + wine · electron-windows");
    expect(targetSubtitle("script")).toBe("Logs only · script");
    expect(targetSubtitle("ios")).toBeNull();
  });

  it("maps build states", () => {
    expect(buildStatus(build({ state: "cancelled" }))).toEqual({ label: "Cancelled", tone: "warning", glyph: true });
    expect(buildStatus(build({ state: "queued" }))).toEqual({ label: "Queued", tone: "neutral", glyph: true });
    expect(buildStatus(build({ state: "running" })).tone).toBe("info");
  });

  it("formats meta for running and final builds", () => {
    const running = build({ state: "running", profile: "debug", stage: "package", startedAt: "2026-09-23T11:58:00Z", artifacts: [] });
    expect(buildMeta(running, NOW)).toBe("Debug · 2m ago · package");
    const queued = build({ state: "queued", profile: "release", stage: null, startedAt: null, createdAt: "2026-09-23T11:59:50Z", artifacts: [] });
    expect(buildMeta(queued, NOW)).toBe("Release · just now");
    const done = build({
      state: "succeeded",
      profile: "release",
      startedAt: "2026-09-23T11:00:00Z",
      endedAt: "2026-09-23T11:02:05Z",
      artifacts: [sampleArtifact],
    });
    expect(buildMeta(done, NOW)).toBe("Release · 1h ago · 2m 5s · 1 artifacts");
  });

  it("only shows progress while not final", () => {
    expect(buildProgress(build({ state: "running", progress: 0.4 }))).toBe(0.4);
    expect(buildProgress(build({ state: "queued", progress: null }))).toBeNull();
    expect(buildProgress(build({ state: "failed" }))).toBeUndefined();
  });

  it("describes the cancel confirmation", () => {
    expect(cancelBody(build({ target: "android-apk", profile: "release" }))).toBe("Android APK (Release) stops and its outputs are discarded.");
  });
});
