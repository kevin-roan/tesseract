import { describe, expect, it } from "vitest";
import type { HostInfo } from "../../../shared/contracts/onboarding";
import { formatSize, requirementChecks } from "./model";

const GIB = 1024 ** 3;

const HOST: HostInfo = {
  platform: "linux",
  arch: "x64",
  osVersion: "6.17",
  cpus: 16,
  memBytes: 32 * GIB,
  translated: false,
  homeDir: "/home/dev",
  freeDiskBytes: 412 * GIB,
};

describe("requirementChecks", () => {
  it("passes a comfortable machine", () => {
    expect(requirementChecks(HOST)).toEqual([
      { id: "disk", title: "Disk space", subtitle: "412 GB free in /home/dev", status: "ok" },
      { id: "memory", title: "Memory", subtitle: "32 GB", status: "ok" },
      { id: "processor", title: "Processor", subtitle: "16 cores · x64", status: "ok" },
    ]);
  });

  it("warns about low disk, low memory and arm64 Linux", () => {
    const checks = requirementChecks({ ...HOST, arch: "arm64", memBytes: 8 * GIB, freeDiskBytes: 20 * GIB });
    expect(checks.map((check) => check.status)).toEqual(["warning", "warning", "warning"]);
    expect(checks[0]?.subtitle).toContain("About 40 GB is recommended");
    expect(checks[1]?.subtitle).toContain("16 GB or more is comfortable");
    expect(checks[2]?.subtitle).toContain("The Android emulator isn't available for this processor");
  });

  it("does not warn about arm64 macOS", () => {
    expect(requirementChecks({ ...HOST, platform: "darwin", arch: "arm64" })[2]?.status).toBe("ok");
  });

  it("shows placeholders while the host is unknown", () => {
    expect(requirementChecks(null).every((check) => check.status === "running")).toBe(true);
    expect(requirementChecks(null, true).every((check) => check.status === "pending")).toBe(true);
  });

  it("keeps unknown free space neutral", () => {
    expect(requirementChecks({ ...HOST, freeDiskBytes: null })[0]?.status).toBe("pending");
  });
});

describe("formatSize", () => {
  it("uses GB and TB", () => {
    expect(formatSize(412 * GIB)).toBe("412 GB");
    expect(formatSize(1.5 * 1024 * GIB)).toBe("1.5 TB");
    expect(formatSize(2.25 * GIB)).toBe("2.3 GB");
  });
});
