import { describe, expect, it } from "vitest";
import type { HostInfo, OnboardingState } from "../../shared/contracts/onboarding";
import type { SetupChoices } from "../../shared/contracts/sandbox";
import { initialOnboardingState } from "./index";
import { canonicalStep, nextStep, resolveStatuses } from "./statuses";

const HOST: HostInfo = {
  platform: "linux",
  arch: "x64",
  osVersion: "6.0",
  cpus: 8,
  memBytes: 16e9,
  translated: false,
  homeDir: "/home/dev",
  freeDiskBytes: 100e9,
};

function state(patch: Partial<OnboardingState> = {}): OnboardingState {
  return { ...initialOnboardingState(HOST, {} as SetupChoices), ...patch };
}

describe("onboarding statuses", () => {
  it("marks the current step active and the rest pending", () => {
    const statuses = resolveStatuses(state(), new Set(), "linux");
    expect(statuses.welcome).toBe("active");
    expect(statuses.docker).toBe("pending");
  });

  it("derives done, running and skipped", () => {
    const statuses = resolveStatuses(
      state({ step: "android", build: { kind: "done", apiUrl: "http://127.0.0.1:7700", imageId: "sha256:1" }, android: { kind: "installing", pkg: "emulator", index: 0, count: 1, stage: "downloading", received: 0, total: 1, bytesPerSecond: null } }),
      new Set(["pair"]),
      "linux",
    );
    expect(statuses.welcome).toBe("done");
    expect(statuses.sandbox).toBe("done");
    expect(statuses.build).toBe("done");
    expect(statuses.android).toBe("running");
    expect(statuses.pair).toBe("skipped");
  });

  it("folds the build step into the sandbox step", () => {
    expect(canonicalStep("build")).toBe("sandbox");
    expect(nextStep("sandbox")).toBe("android");
    expect(nextStep("pair")).toBe("finish");
    expect(nextStep("finish")).toBe("finish");
  });
});
