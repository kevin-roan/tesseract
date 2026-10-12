import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VmStatus } from "../../src/shared/contracts/vm";
import { runCli, tempSandbox, type Sandbox } from "../testing";
import { EXIT } from "../types";
import { describePhase, describeVm } from "./vm";

const vm = vi.hoisted(() => ({ vmStatus: vi.fn(), setupVm: vi.fn(), startVm: vi.fn(), stopVm: vi.fn() }));

vi.mock("../../src/core/vm", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../src/core/vm")>()), ...vm }));

const containers = vi.hoisted(() => ({ hasSysbox: vi.fn(), imagePresent: vi.fn(), activeContext: vi.fn() }));

vi.mock("../../src/core/containers/docker", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/containers/docker")>()),
  ...containers,
}));

const STATUS: VmStatus = {
  state: "running",
  profile: "tesseract",
  context: "colima-tesseract",
  tools: { brew: "/opt/homebrew/bin/brew", colima: "/opt/homebrew/bin/colima", limactl: "/opt/homebrew/bin/limactl", docker: "/opt/homebrew/bin/docker", compose: null, buildx: null },
  sysbox: true,
  activeContext: "desktop-linux",
  active: false,
  size: { cpus: 6, memoryGb: 5, diskGb: 120 },
  dockerDesktopRunning: true,
};

let sandbox: Sandbox;
let mac: Sandbox;

beforeEach(() => {
  sandbox = tempSandbox();
  mac = { ...sandbox, runtime: { ...sandbox.runtime, platform: "darwin" } };
  containers.hasSysbox.mockResolvedValue(false);
  containers.imagePresent.mockResolvedValue(true);
  containers.activeContext.mockResolvedValue("colima-tesseract");
});

afterEach(() => {
  sandbox.cleanup();
  vi.clearAllMocks();
});

describe("vm output", () => {
  it("describes the VM", () => {
    const lines = describeVm(STATUS).join("\n");
    expect(lines).toMatch(/State:\s+running/);
    expect(lines).toMatch(/Docker uses it:\s+no \(active context: desktop-linux\)/);
    expect(lines).toMatch(/Sysbox:\s+yes/);
    expect(lines).toMatch(/6 CPUs, 5 GB memory, 120 GB disk/);
    expect(lines).toMatch(/colima:\s+\/opt\/homebrew\/bin\/colima/);
    expect(lines).toMatch(/docker compose:\s+not installed/);
  });

  it("describes phases", () => {
    expect(describePhase({ kind: "ready" }, "done")).toEqual(["done"]);
    expect(describePhase({ kind: "blocked", reason: "Homebrew is missing", commands: ["install brew"] }, "done")).toEqual([
      "The Tesseract VM isn't ready: Homebrew is missing",
      "  install brew",
    ]);
  });
});

describe("tesseract vm", () => {
  it("is only needed on macOS", async () => {
    const result = await runCli(sandbox, ["vm", "setup"]);
    expect(result.code).toBe(EXIT.usage);
    expect(result.err.join("\n")).toMatch(/only needed on macOS/);
    expect(vm.setupVm).not.toHaveBeenCalled();
  });

  it("prints the status and warns about Docker Desktop", async () => {
    vm.vmStatus.mockResolvedValue(STATUS);
    const result = await runCli(mac, ["vm"]);
    expect(result.code).toBe(EXIT.ok);
    expect(result.out.join("\n")).toMatch(/Profile:\s+tesseract/);
    expect(result.err.join("\n")).toMatch(/Docker Desktop is running/);
  });

  it("sets the VM up with the sandbox context and streams logs", async () => {
    vm.setupVm.mockImplementation(async (options: { onLog?(line: string): void }) => {
      options.onLog?.("brew install colima");
      return { kind: "ready" };
    });
    const result = await runCli(mac, ["vm", "setup"]);
    expect(result.code).toBe(EXIT.ok);
    expect(vm.setupVm).toHaveBeenCalledWith(expect.objectContaining({ resourcesDir: sandbox.contextDir }));
    expect(result.err).toContain("brew install colima");
    expect(result.out).toEqual(["The Tesseract VM is ready"]);
  });

  it("fails when setup is blocked", async () => {
    vm.setupVm.mockResolvedValue({ kind: "blocked", reason: "Homebrew is missing", commands: ["install brew"] });
    const result = await runCli(mac, ["vm", "setup"]);
    expect(result.code).toBe(EXIT.error);
    expect(result.out.join("\n")).toMatch(/Homebrew is missing/);
  });

  it("starts and stops the VM", async () => {
    vm.startVm.mockResolvedValue({ kind: "ready" });
    vm.stopVm.mockResolvedValue({ kind: "ready" });
    expect((await runCli(mac, ["vm", "start"])).out).toEqual(["The Tesseract VM is ready"]);
    expect((await runCli(mac, ["vm", "stop"])).out).toEqual(["The Tesseract VM is stopped"]);
  });

  it("rejects unknown subcommands", async () => {
    expect((await runCli(mac, ["vm", "reboot"])).code).toBe(EXIT.usage);
  });
});

describe("tesseract containers doctor", () => {
  it("points macOS at tesseract vm setup", async () => {
    const result = await runCli(mac, ["containers", "doctor"]);
    expect(result.code).toBe(EXIT.error);
    expect(result.out.join("\n")).toMatch(/Tesseract VM/);
    expect(result.err.join("\n")).toMatch(/tesseract vm setup/);
  });

  it("keeps the Linux sysbox advice", async () => {
    const result = await runCli(sandbox, ["containers", "doctor"]);
    expect(result.code).toBe(EXIT.error);
    expect(result.out.join("\n")).toMatch(/Install Sysbox/);
    expect(result.err.join("\n")).not.toMatch(/tesseract vm setup/);
  });
});
