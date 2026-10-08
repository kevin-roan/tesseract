import { describe, expect, it } from "vitest";
import type { SandboxStackStatus } from "../../../../shared/contracts/sandbox";
import { ENGINE_REPORT } from "../../../fixtures/onboarding-sandbox/data";
import { BUILD_LOG_LIMIT } from "./constants";
import { appendLog, buildActive, dockerBadge, dockerReady, dockerSubtitle, imageSubtitle, lastFraction, sameComponents, stackBadge, stackSubtitle, toggleComponent } from "./model";

const status = (states: string[]): SandboxStackStatus => ({
  configured: true,
  project: "tesseract",
  services: states.map((state, index) => ({ service: `s${index}`, container: `c${index}`, state, health: null })),
});

describe("sandbox settings model", () => {
  it("summarises Docker", () => {
    expect(dockerBadge(null).label).toBe("Checking…");
    expect(dockerBadge(ENGINE_REPORT)).toEqual({ label: "Running", tone: "success" });
    expect(dockerBadge({ ...ENGINE_REPORT, cli: null }).label).toBe("Not installed");
    expect(dockerBadge({ ...ENGINE_REPORT, daemon: "permission" }).tone).toBe("danger");
    expect(dockerReady(ENGINE_REPORT)).toBe(true);
    expect(dockerReady({ ...ENGINE_REPORT, daemon: "stopped" })).toBe(false);
    expect(dockerSubtitle(ENGINE_REPORT)).toBe("Docker Engine 28.5.1 · 16 CPUs · 32 GB");
    expect(dockerSubtitle({ ...ENGINE_REPORT, daemon: "stopped", daemonError: "Cannot connect" })).toBe("Cannot connect");
  });

  it("summarises the compose stack", () => {
    expect(stackBadge(null).label).toBe("Not set up");
    expect(stackBadge(status(["running", "running"])).label).toBe("Running");
    expect(stackBadge(status(["running", "exited"])).label).toBe("Partly running");
    expect(stackBadge(status(["exited"])).label).toBe("Stopped");
    expect(stackSubtitle(status(["running", "running"]), null)).toBe("Compose project tesseract · 2 containers");
    const stack = { envFile: "", project: "tesseract", mode: "local" as const, image: "tesseract/sandbox:latest", builtAt: null, components: [] };
    expect(imageSubtitle(stack, () => "")).toBe("tesseract/sandbox:latest · not built yet");
    expect(imageSubtitle({ ...stack, builtAt: "2026-10-04T18:12:00Z" }, () => "2 days ago")).toBe("tesseract/sandbox:latest · built 2 days ago");
  });

  it("toggles components in Dockerfile order", () => {
    expect(toggleComponent(["whisper"], "android", true)).toEqual(["android", "whisper"]);
    expect(toggleComponent(["android", "whisper"], "android", false)).toEqual(["whisper"]);
    expect(sameComponents(["whisper", "android"], ["android", "whisper"])).toBe(true);
    expect(sameComponents(["android"], ["android", "mono"])).toBe(false);
  });

  it("tracks the build", () => {
    expect(buildActive({ kind: "idle" })).toBe(false);
    expect(buildActive({ kind: "waiting", since: 0 })).toBe(true);
    expect(buildActive({ kind: "failed", phase: "build", message: "x" })).toBe(false);
    expect(lastFraction(0.2, { kind: "pulling", fraction: 0.5, detail: "" })).toBe(0.5);
    expect(lastFraction(0.2, { kind: "starting" })).toBe(0.2);
    const lines = Array.from({ length: BUILD_LOG_LIMIT }, (_, index) => String(index));
    const next = appendLog(lines, "new");
    expect(next).toHaveLength(BUILD_LOG_LIMIT);
    expect(next.at(-1)).toBe("new");
  });
});
