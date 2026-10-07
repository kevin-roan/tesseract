import { describe, expect, it } from "vitest";
import type { HostInfo } from "../../../shared/contracts/onboarding";
import type { SetupChoices } from "../../../shared/contracts/sandbox";
import { DESKTOP_REPORT, ENGINE_REPORT } from "../../fixtures/onboarding-sandbox/data";
import {
  advanceTrack,
  buildRows,
  choicesForSource,
  diskRequirementGb,
  diskStatus,
  EMPTY_TRACK,
  footerMode,
  formatBytes,
  formatDuration,
  formatRelative,
  imageSizeGb,
  issuesByField,
  nextStepAfter,
  progressView,
  resourceLimits,
  stepCounter,
  toggleComponent,
  toggleWhisperModel,
  trackDurations,
} from "./model";

const HOST: HostInfo = {
  platform: "linux",
  arch: "x64",
  osVersion: "6.17",
  cpus: 16,
  memBytes: 32 * 1024 ** 3,
  translated: false,
  homeDir: "/home/dev",
  freeDiskBytes: 100e9,
};

const CHOICES = {
  components: ["android", "whisper"],
  whisperModels: ["base", "small"],
  useExistingImage: false,
} as unknown as SetupChoices;

describe("sizes", () => {
  it("sums the image size and the disk requirement like the build preflight", () => {
    expect(imageSizeGb([])).toBeCloseTo(4.7);
    expect(imageSizeGb(["android", "flutter", "mono", "whisper"])).toBeCloseTo(7.8);
    expect(diskRequirementGb([])).toBe(25);
    expect(diskRequirementGb(["android", "flutter", "mono", "whisper"])).toBe(35);
  });
});

describe("choices", () => {
  it("keeps components in build-arg order", () => {
    expect(toggleComponent(CHOICES, "flutter", true).components).toEqual(["android", "flutter", "whisper"]);
    expect(toggleComponent(CHOICES, "android", false).components).toEqual(["whisper"]);
  });

  it("keeps at least one whisper model, in the order shown", () => {
    expect(toggleWhisperModel(["small"], "small")).toEqual(["small"]);
    expect(toggleWhisperModel(["small"], "base")).toEqual(["base", "small"]);
    expect(toggleWhisperModel(["base", "small"], "base")).toEqual(["small"]);
  });

  it("maps the image source onto the saved choices", () => {
    expect(choicesForSource(CHOICES, "existing").useExistingImage).toBe(true);
    expect(choicesForSource(CHOICES, "pull").components).toEqual(["android", "flutter", "mono", "whisper"]);
    expect(choicesForSource(CHOICES, "build")).toEqual(CHOICES);
  });

  it("indexes validation issues by field, first message wins", () => {
    expect(
      issuesByField([
        { field: "project", message: "a" },
        { field: "project", message: "b" },
      ]),
    ).toEqual({ project: "a" });
  });
});

describe("disk and resources", () => {
  it("measures the host disk only for Linux engines", () => {
    expect(diskStatus(HOST, ENGINE_REPORT, []).kind).toBe("ok");
    expect(diskStatus({ ...HOST, freeDiskBytes: 20e9 }, ENGINE_REPORT, []).message).toBe(
      "Only 20.0 GB free; the build needs about 25 GB.",
    );
    expect(diskStatus(HOST, DESKTOP_REPORT, []).kind).toBe("vm");
    expect(diskStatus(HOST, null, []).kind).toBe("unknown");
    expect(diskStatus({ ...HOST, platform: "darwin" }, ENGINE_REPORT, []).kind).toBe("vm");
  });

  it("limits resources to the engine", () => {
    expect(resourceLimits(HOST, DESKTOP_REPORT)).toEqual({
      maxCpus: 8,
      maxMemoryGb: 12,
    });
    expect(resourceLimits(HOST, null)).toEqual({
      maxCpus: 16,
      maxMemoryGb: 32,
    });
  });
});

describe("build progress", () => {
  it("derives the footer mode", () => {
    expect(footerMode({ kind: "idle" })).toBe("idle");
    expect(footerMode({ kind: "waiting", since: 0 })).toBe("running");
    expect(footerMode({ kind: "failed", phase: "up", message: "x" })).toBe("failed");
    expect(footerMode({ kind: "cancelled" })).toBe("cancelled");
    expect(footerMode({ kind: "done", apiUrl: "u", imageId: "i" })).toBe("done");
  });

  it("marks the checklist rows by phase", () => {
    const statuses = (rows: ReturnType<typeof buildRows>) => rows.map((row) => row.status);
    expect(statuses(buildRows({ kind: "starting" }, "build", null, {}))).toEqual(["done", "running", "pending", "pending"]);
    expect(statuses(buildRows({ kind: "failed", phase: "health", message: "x" }, "build", null, {}))).toEqual([
      "done",
      "done",
      "error",
      "pending",
    ]);
    expect(statuses(buildRows({ kind: "done", apiUrl: "u", imageId: "i" }, "existing", null, {}))).toEqual([
      "skipped",
      "done",
      "done",
      "done",
    ]);
    expect(statuses(buildRows({ kind: "cancelled" }, "build", 1, {}))).toEqual(["done", "pending", "pending", "pending"]);
    expect(
      buildRows({ kind: "pulling", fraction: 0.5, detail: "" }, "pull", null, {
        image: 75_000,
      })[0],
    ).toEqual({
      id: "image",
      title: "Download image",
      status: "running",
      caption: "1m 15s",
    });
  });

  it("describes the progress", () => {
    const building = progressView(
      {
        kind: "building",
        fraction: 0.4,
        step: "[base 1/6] RUN apt-get",
        cachedSteps: 2,
        doneSteps: 5,
        totalSteps: 10,
        bytes: { current: 412e6, total: 1.9e9 },
      },
      0,
      0,
    );
    expect(building).toEqual({
      label: "Building the image…",
      fraction: 0.4,
      tone: "info",
      detail: "[base 1/6] RUN apt-get · 412 MB of 1.9 GB",
    });
    expect(
      progressView(
        {
          kind: "building",
          fraction: 1,
          step: "",
          cachedSteps: 4,
          doneSteps: 4,
          totalSteps: 4,
        },
        0,
        0,
      ).label,
    ).toBe("Image is up to date");
    expect(progressView({ kind: "failed", phase: "build", message: "boom" }, 0.6, 0)).toMatchObject({
      tone: "danger",
      fraction: 0.6,
      detail: "boom",
    });
    expect(progressView({ kind: "failed", phase: "health", message: "late" }, 0, 0).fraction).toBe(1);
    expect(progressView({ kind: "waiting", since: 0 }, 0, 34_000).detail).toBe("Polling /v1/health · 34s");
    expect(
      stepCounter({
        kind: "building",
        fraction: 0.4,
        step: "",
        cachedSteps: 2,
        doneSteps: 5,
        totalSteps: 10,
      }),
    ).toBe("5 of 10 steps · 2 cached");
  });

  it("tracks row durations across phases and resets on a new start", () => {
    let track = advanceTrack(EMPTY_TRACK, { kind: "preflight" }, 0);
    track = advanceTrack(
      track,
      {
        kind: "building",
        fraction: 0.5,
        step: "",
        cachedSteps: 0,
        doneSteps: 1,
        totalSteps: 2,
      },
      1_000,
    );
    track = advanceTrack(track, { kind: "starting" }, 61_000);
    expect(trackDurations(track, 70_000)).toEqual({ image: 61_000, up: 9_000 });
    expect(track.lastFraction).toBe(0.5);
    track = advanceTrack(track, { kind: "failed", phase: "up", message: "x" }, 80_000);
    expect(trackDurations(track, 99_000).up).toBe(19_000);
    track = advanceTrack(track, { kind: "preflight" }, 100_000);
    expect(trackDurations(track, 100_000)).toEqual({ image: 0 });
  });
});

describe("formatting", () => {
  it("formats durations, bytes and relative times", () => {
    expect(formatDuration(5_400)).toBe("5s");
    expect(formatDuration(134_000)).toBe("2m 14s");
    expect(formatDuration(3_780_000)).toBe("1h 3m");
    expect(formatBytes(7.3e9)).toBe("7.3 GB");
    expect(formatBytes(512)).toBe("512 B");
    const now = Date.parse("2026-10-06T21:00:00Z");
    expect(formatRelative("2026-10-06T20:30:00Z", now)).toBe("30 min ago");
    expect(formatRelative("2026-10-04T18:12:00Z", now)).toBe("2 days ago");
  });

  it("goes past the build step after the sandbox is ready", () => {
    expect(nextStepAfter("build")).toBe("android");
  });
});
