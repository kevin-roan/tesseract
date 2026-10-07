import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli, tempSandbox, type Sandbox } from "../testing";
import { describeDoctor, selectedSections } from "./doctor";

const mocks = vi.hoisted(() => ({
  probeDocker: vi.fn(),
  currentStack: vi.fn(),
  findExisting: vi.fn(),
  checkAcceleration: vi.fn(),
}));

vi.mock("../../src/core/docker", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/docker")>()),
  probeDocker: mocks.probeDocker,
}));

vi.mock("../../src/core/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/sandbox")>()),
  currentStack: mocks.currentStack,
  findExisting: mocks.findExisting,
}));

vi.mock("../../src/core/android", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/android")>()),
  checkAcceleration: mocks.checkAcceleration,
}));

let sandbox: Sandbox;

beforeEach(() => {
  sandbox = tempSandbox();
  mocks.probeDocker.mockResolvedValue({
    checks: [{ id: "cli", status: "ok", title: "Docker", detail: "Docker Engine 28.1.1" }],
  });
  mocks.currentStack.mockResolvedValue({ project: "theone", image: "theone/sandbox:latest" });
  mocks.findExisting.mockResolvedValue({
    image: { ref: "theone/sandbox:latest", sizeBytes: 12 * 1024 ** 3, version: "1.4.0", createdAt: "2026-09-30T10:00:00Z" },
    container: { name: "theone-sandbox-1", state: "running", image: "theone/sandbox:latest", configFiles: null, workingDir: null },
  });
  mocks.checkAcceleration.mockResolvedValue({
    ok: true,
    checks: [{ id: "kvm", status: "ok", title: "KVM", detail: "/dev/kvm is usable" }],
    emulatorCode: null,
    emulatorMessage: null,
  });
});

afterEach(() => {
  sandbox.cleanup();
  vi.clearAllMocks();
});

describe("doctor sections", () => {
  it("defaults to every section and validates names", () => {
    expect(selectedSections([])).toEqual(["docker", "image", "kvm", "sdk"]);
    expect(selectedSections(["kvm"])).toEqual(["kvm"]);
    expect(() => selectedSections(["gpu"])).toThrow(/unknown check gpu/);
  });

  it("indents multi-line details", () => {
    const lines = describeDoctor({
      ok: false,
      sections: [{ id: "kvm", title: "Hardware acceleration", checks: [{ id: "k", status: "error", title: "KVM", detail: "missing\nload kvm" }] }],
    });
    expect(lines).toEqual(["Hardware acceleration", "  FAIL KVM: missing", "       load kvm", "1 problem found."]);
  });
});

describe("monolith doctor", () => {
  it("reports docker, image, acceleration and sdk checks", async () => {
    const result = await runCli(sandbox, ["doctor", "--json"]);
    const report = JSON.parse(result.out.join("\n"));
    expect(result.code).toBe(0);
    expect(report.sections.map((section: { id: string }) => section.id)).toEqual(["docker", "image", "kvm", "sdk"]);
    expect(report.sections[1].checks[0]).toMatchObject({ status: "ok", title: "theone/sandbox:latest", detail: "12 GB · version 1.4.0 · created 2026-09-30" });
    expect(report.sections[3].checks[0]).toMatchObject({ status: "warning", title: "No Android SDK found" });
  });

  it("fails when the image is missing and when a probe throws", async () => {
    mocks.findExisting.mockResolvedValue({ image: null, container: null });
    mocks.probeDocker.mockRejectedValue(new Error("docker exploded"));
    const result = await runCli(sandbox, ["doctor", "docker", "image"]);
    expect(result.code).toBe(1);
    expect(result.out).toContain("  FAIL Check failed: docker exploded");
    expect(result.out).toContain("  FAIL theone/sandbox:latest is not on this computer: Run monolith sandbox build (or --pull) to get it");
    expect(result.out.at(-1)).toBe("2 problems found.");
  });

  it("warns when the sandbox is not configured", async () => {
    mocks.currentStack.mockResolvedValue(null);
    const result = await runCli(sandbox, ["doctor", "image"]);
    expect(result.code).toBe(0);
    expect(result.out[1]).toContain("warn Sandbox not configured");
  });
});
