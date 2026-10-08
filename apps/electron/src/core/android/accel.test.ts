import { describe, expect, it } from "vitest";
import type { CommandResult } from "../process";
import { accelHint, checkAcceleration, kvmModule, parseAccelCheck, type AccelProbes } from "./accel";
import { testPaths } from "./test-support";

const OK_OUTPUT = "accel:\n0\nKVM (version 12) is installed and usable.\naccel\n";

function result(code: number, stdout = "", timedOut = false): CommandResult {
  return { code, stdout, stderr: "", timedOut };
}

function probes(overrides: Partial<AccelProbes> & { commands?: Record<string, CommandResult> } = {}): AccelProbes & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    exists: overrides.exists ?? (async () => true),
    canReadWrite: overrides.canReadWrite ?? (async () => true),
    readText: overrides.readText ?? (async () => null),
    run: async (file, args) => {
      const key = [file.split(/[\\/]/).at(-1), ...args].join(" ");
      calls.push(key);
      const match = Object.entries(overrides.commands ?? {}).find(([prefix]) => key.startsWith(prefix));
      return match ? match[1] : result(0);
    },
  };
}

describe("parseAccelCheck", () => {
  it("reads the status code and message", () => {
    expect(parseAccelCheck(OK_OUTPUT)).toEqual({ code: 0, message: "KVM (version 12) is installed and usable." });
    expect(parseAccelCheck("INFO noise\r\naccel:\r\n11\r\nThis user doesn't have permissions to use KVM (/dev/kvm).\r\naccel\r\n")).toEqual({
      code: 11,
      message: "This user doesn't have permissions to use KVM (/dev/kvm).",
    });
    expect(parseAccelCheck("garbage")).toBeNull();
  });

  it("maps codes to hints", () => {
    expect(accelHint(11)).toContain("kvm group");
    expect(accelHint(8)).toContain("/dev/kvm is missing");
    expect(accelHint(4)).toContain("VT-x");
    expect(accelHint(42)).toBeNull();
  });

  it("picks the kvm module from the CPU vendor", () => {
    expect(kvmModule("vendor_id\t: AuthenticAMD")).toBe("kvm_amd");
    expect(kvmModule("vendor_id\t: GenuineIntel")).toBe("kvm_intel");
    expect(kvmModule(null)).toBe("kvm_intel");
  });
});

describe("checkAcceleration", () => {
  it("passes on a Linux host with KVM, isolation and a working emulator", async () => {
    const fake = probes({ commands: { "emulator -accel-check": result(0, OK_OUTPUT) } });
    const report = await checkAcceleration(testPaths("/home/u"), "/sdk", fake);
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => `${check.id}:${check.status}`)).toEqual(["kvm:ok", "kvm-access:ok", "isolation:ok", "emulator:ok"]);
    expect(report.emulatorCode).toBe(0);
    expect(fake.calls).toContain("unshare --user --map-root-user --net -- ip link add tesseract0 type dummy");
  });

  it("reports missing KVM with the vendor module and skips the emulator before install", async () => {
    const fake = probes({
      exists: async (path) => path !== "/dev/kvm" && !path.includes("emulator"),
      readText: async () => "vendor_id : AuthenticAMD",
      commands: { unshare: result(1) },
    });
    const report = await checkAcceleration(testPaths("/home/u"), "/sdk", fake);
    expect(report.ok).toBe(false);
    expect(report.checks[0]).toMatchObject({ id: "kvm", status: "error", action: "accel-docs" });
    expect(report.checks[0]?.detail).toContain("sudo modprobe kvm_amd");
    expect(report.checks[1]).toMatchObject({ id: "isolation", status: "warning", action: "userns-docs" });
    expect(report.emulatorCode).toBeNull();
  });

  it("warns about /dev/kvm permissions and surfaces the emulator error", async () => {
    const fake = probes({
      canReadWrite: async () => false,
      commands: { "emulator -accel-check": result(1, "accel:\n11\nThis user doesn't have permissions to use KVM (/dev/kvm).\naccel\n") },
    });
    const report = await checkAcceleration(testPaths("/home/u"), "/sdk", fake);
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "kvm-access")).toMatchObject({ status: "warning", action: "kvm-group" });
    expect(report.checks.find((check) => check.id === "emulator")).toMatchObject({ status: "error", action: "kvm-group" });
    expect(report.emulatorMessage).toBe("This user doesn't have permissions to use KVM (/dev/kvm).");
  });

  it("checks WHPX on Windows", async () => {
    const off = await checkAcceleration(testPaths("C:\\Users\\u", {}, "win32"), null, probes({ commands: { powershell: result(0, "2\r\n") } }));
    expect(off.checks).toEqual([
      { id: "whpx", status: "warning", title: "Windows Hypervisor Platform", detail: "Windows Hypervisor Platform is off", action: "enable-whpx" },
    ]);
    expect(off.ok).toBe(true);
    const on = await checkAcceleration(testPaths("C:\\Users\\u", {}, "win32"), null, probes({ commands: { powershell: result(0, "1\r\n") } }));
    expect(on.checks[0]?.status).toBe("ok");
    const denied = await checkAcceleration(testPaths("C:\\Users\\u", {}, "win32"), null, probes({ commands: { powershell: result(1, "") } }));
    expect(denied.checks).toEqual([]);
  });

  it("checks Hypervisor.framework on macOS", async () => {
    const missing = await checkAcceleration(testPaths("/Users/u", {}, "darwin"), null, probes({ commands: { sysctl: result(0, "0\n") } }));
    expect(missing).toMatchObject({ ok: false, checks: [{ id: "hvf", status: "error" }] });
    const ok = await checkAcceleration(testPaths("/Users/u", {}, "darwin"), null, probes({ commands: { sysctl: result(0, "1\n") } }));
    expect(ok.ok).toBe(true);
  });

  it("reports an emulator check that times out", async () => {
    const report = await checkAcceleration(testPaths("/home/u"), "/sdk", probes({ commands: { "emulator -accel-check": result(1, "", true) } }));
    expect(report.emulatorCode).toBe(-1);
    expect(report.emulatorMessage).toBe("The emulator's acceleration check did not answer in time");
  });
});
