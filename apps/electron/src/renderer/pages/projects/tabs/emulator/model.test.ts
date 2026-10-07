import { ApiError } from "@theone/client";
import type { HostAndroidStatus, RunTargetInfo } from "@theone/protocol";
import { sampleAppRun, sampleHostAndroidStatus } from "@theone/protocol/fixtures";
import { describe, expect, it } from "vitest";
import type { HostShellState } from "../../../../../shared/contracts/hostShell";
import { confirmSteps, displayButton, emulatorReady, hostBlocker, hostUnlocked, isLinkedTo, planEmulator } from "./model";

const target = (patch: Partial<RunTargetInfo> = {}): RunTargetInfo => ({
  target: "expo-android",
  label: "Android emulator",
  dir: null,
  available: true,
  reason: null,
  viewer: "android",
  actions: [],
  ...patch,
});

const SANDBOX = "http://100.64.0.2:7700";

const status = (patch: Partial<HostAndroidStatus> = {}, emulator: Partial<HostAndroidStatus["emulator"]> = {}, link: Partial<HostAndroidStatus["link"]> = {}): HostAndroidStatus => ({
  ...sampleHostAndroidStatus,
  ...patch,
  emulator: { ...sampleHostAndroidStatus.emulator, ...emulator },
  link: { ...sampleHostAndroidStatus.link, ...link },
});

const host = (patch: Partial<HostShellState> = {}): HostShellState => ({
  status: "running",
  pairing: { link: "", url: "", name: "", pinSet: true },
  error: null,
  log: [],
  autostart: false,
  sessionExpiresAt: null,
  ...patch,
});

describe("display button", () => {
  it("keeps Display for non-Android projects", () => {
    expect(displayButton(null, null, "next")).toMatchObject({ mode: "display", label: "Display", icon: "display", disabled: false });
  });

  it("disables the emulator button for Android projects without a target", () => {
    expect(displayButton(null, null, "expo")).toMatchObject({ mode: "unsupported", tooltip: null, disabled: true });
    expect(displayButton([], null, "expo").tooltip).toBe("No Android app was detected in this project");
    expect(displayButton(null, null, "expo", new ApiError(404, "not_found", "x")).tooltip).toBe(
      "This sandbox can't run apps on the emulator yet; update the sandbox",
    );
    expect(displayButton(null, null, "android", new Error("boom")).tooltip).toBe("Couldn't read the project's run targets: boom");
  });

  it("switches to Show emulator with a live run", () => {
    const run = { ...sampleAppRun, target: "expo-android" as const, state: "ready" as const };
    expect(displayButton([target()], [run], "expo").label).toBe("Show emulator");
    expect(displayButton([target()], [{ ...run, state: "exited" }], "expo").label).toBe("Open on emulator");
  });

  it("explains the target", () => {
    expect(displayButton([target({ dir: "apps/mobile" })], [], "expo").tooltip).toBe(
      "Build the app in apps/mobile and install it on the host Android emulator",
    );
    expect(displayButton([target({ available: false, reason: "Start the emulator on the host" })], [], "expo").tooltip).toBe(
      "Start the emulator on the host. Monolith starts and links the emulator on this computer first",
    );
    expect(displayButton([target({ available: false, reason: "No SDK" })], [], "expo").tooltip).toBe("No SDK");
  });
});

describe("host checks", () => {
  it("blocks on the host shell state", () => {
    expect(hostBlocker(host({ status: "stopped" }))).toMatch(/^The host shell isn't running/);
    expect(hostBlocker(host({ status: "starting" }))).toMatch(/^Monolith is still reading/);
    expect(hostBlocker(host({ pairing: null }))).toMatch(/^Monolith is still reading/);
    expect(hostBlocker(host({ pairing: { link: "", url: "", name: "", pinSet: false } }))).toMatch(/^Set a host shell PIN/);
    expect(hostBlocker(host())).toBeNull();
  });

  it("knows when the session is live", () => {
    expect(hostUnlocked(host({ sessionExpiresAt: 2000 }), 1000)).toBe(true);
    expect(hostUnlocked(host({ sessionExpiresAt: 500 }), 1000)).toBe(false);
    expect(hostUnlocked(host(), 1000)).toBe(false);
  });

  it("compares sandbox URLs loosely", () => {
    expect(isLinkedTo({ configured: true, sandboxUrl: " HTTP://100.64.0.2:7700/ ", connected: true, lastError: null }, SANDBOX)).toBe(true);
    expect(isLinkedTo({ configured: false, sandboxUrl: SANDBOX, connected: true, lastError: null }, SANDBOX)).toBe(false);
  });
});

describe("plan", () => {
  it("is blocked when the host can't help", () => {
    expect(planEmulator(status({ available: false, reason: "No SDK" }), SANDBOX).blocked).toBe("No SDK");
    expect(planEmulator(status({}, { state: "unavailable" }), SANDBOX).blocked).toBe("The host can't run the Android emulator");
    expect(planEmulator(status({ isolation: "none" }), SANDBOX).blocked).toMatch(/THEONE_EMULATOR_ISOLATION=none/);
    expect(planEmulator(status({}, { state: "stopping" }), SANDBOX).blocked).toBe("The emulator is stopping; try again in a moment");
    expect(planEmulator(status({ avds: [] }, { state: "stopped", avd: null }), SANDBOX).blocked).toMatch(/no Android virtual device/);
  });

  it("only links a running isolated emulator", () => {
    expect(planEmulator(status(), SANDBOX)).toMatchObject({ stop: false, avd: null, link: false, replaces: null });
    expect(planEmulator(status({}, {}, { sandboxUrl: "http://other:7700" }), SANDBOX)).toMatchObject({ link: true, replaces: "http://other:7700" });
  });

  it("restarts a non-isolated emulator with the current AVD", () => {
    const plan = planEmulator(status({ avds: ["A", "B"] }, { isolated: false, avd: "B" }), SANDBOX);
    expect(plan).toMatchObject({ stop: true, avd: "B", link: false });
    expect(confirmSteps(plan)).toEqual([{ kind: "restart", avd: "B" }]);
  });

  it("starts the first AVD when stopped", () => {
    expect(planEmulator(status({ avds: ["A"] }, { state: "stopped", avd: "gone" }, { configured: false, connected: false }), SANDBOX)).toMatchObject({
      stop: false,
      avd: "A",
      link: true,
      replaces: null,
    });
  });

  it("checks readiness", () => {
    expect(emulatorReady(status(), SANDBOX)).toBe(true);
    expect(emulatorReady(status({}, { isolated: false }), SANDBOX)).toBe(false);
  });
});
