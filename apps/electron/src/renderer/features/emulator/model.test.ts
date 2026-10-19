import { sampleHostAndroidStatus, sampleHostIosStatus, sampleSimDevice } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { INITIAL_SCREEN } from "./constants";
import { ANDROID_LABELS, IOS_LABELS } from "./labels";
import { androidSnapshot, canStart, canStop, iosSnapshot, isLinkedTo, linkBadge, pickTarget, screenLive, screenOverlay } from "./model";

const running = androidSnapshot({
  ...sampleHostAndroidStatus,
  emulator: { ...sampleHostAndroidStatus.emulator, state: "running", avd: "Pixel_8_API_35", serial: "127.0.0.1:41555" },
});
const stopped = androidSnapshot({ ...sampleHostAndroidStatus, emulator: { ...sampleHostAndroidStatus.emulator, state: "stopped", serial: null } });

describe("emulator model", () => {
  it("normalizes the host Android status", () => {
    expect(running.targets).toEqual([{ id: "Pixel_8_API_35", label: "Pixel_8_API_35" }]);
    expect(running.device).toBe("127.0.0.1:41555");
    expect(screenLive(running)).toBe(true);
    expect(screenLive(stopped)).toBe(false);
  });

  it("picks the selected, the running, then the first target", () => {
    expect(pickTarget(running, "nope")).toBe("Pixel_8_API_35");
    expect(pickTarget({ ...stopped, targets: [{ id: "a", label: "a" }, { id: "b", label: "b" }] }, "b")).toBe("b");
    expect(pickTarget(null, "a")).toBeNull();
  });

  it("allows start only when stopped and stop/kill while active", () => {
    expect(canStart(stopped, "Pixel_8_API_35")).toBe(true);
    expect(canStart(running, "Pixel_8_API_35")).toBe(false);
    expect(canStop(running)).toBe(true);
    expect(canStop(stopped)).toBe(false);
    expect(canStart({ ...stopped, available: false }, "x")).toBe(false);
  });

  it("describes the sandbox link", () => {
    const link = { configured: true, sandboxUrl: "http://100.64.0.2:7700/", connected: true, lastError: null };
    expect(isLinkedTo(link, "http://100.64.0.2:7700")).toBe(true);
    expect(linkBadge(link, "http://100.64.0.2:7700")).toEqual({ label: "Connected", tone: "success" });
    expect(linkBadge(link, "http://other:7700").tone).toBe("warning");
    expect(linkBadge({ ...link, configured: false }, null).label).toBe("Not linked");
  });

  it("overlays the screen until it streams", () => {
    expect(screenOverlay(stopped, INITIAL_SCREEN, ANDROID_LABELS)?.title).toBe("The emulator is off");
    expect(screenOverlay(running, INITIAL_SCREEN, ANDROID_LABELS)?.spinner).toBe(true);
    expect(screenOverlay(running, { ...INITIAL_SCREEN, status: "connected" }, ANDROID_LABELS)).toBeNull();
    expect(screenOverlay(running, { ...INITIAL_SCREEN, status: "error", error: "boom" }, ANDROID_LABELS)).toMatchObject({ message: "boom", actionLabel: "Reconnect" });
  });

  it("normalizes the host iOS status", () => {
    const booted = iosSnapshot(sampleHostIosStatus);
    expect(booted).toMatchObject({ available: true, state: "running", target: sampleSimDevice.udid, device: sampleSimDevice.udid, size: { width: 1206, height: 2622 } });
    expect(booted.targets[0]).toEqual({ id: sampleSimDevice.udid, label: "iPhone 17 Pro · iOS 26.0" });
    expect(screenLive(booted)).toBe(true);

    const booting = iosSnapshot({ ...sampleHostIosStatus, booted: null, devices: [{ ...sampleSimDevice, state: "booting" }] });
    expect(booting).toMatchObject({ state: "starting", device: null });
    expect(screenOverlay(booting, INITIAL_SCREEN, IOS_LABELS)?.title).toBe("Booting the simulator…");

    const off = iosSnapshot({ ...sampleHostIosStatus, booted: null, devices: [{ ...sampleSimDevice, state: "shutdown" }] });
    expect(off.state).toBe("stopped");
    expect(canStart(off, sampleSimDevice.udid)).toBe(true);
  });

  it("explains why the iOS Simulator is unavailable", () => {
    const linux = iosSnapshot({ ...sampleHostIosStatus, available: false, reasonCode: "not_macos", reason: "not a Mac", booted: null, devices: [] });
    expect(linux.state).toBe("unavailable");
    expect(screenOverlay(linux, INITIAL_SCREEN, IOS_LABELS)).toMatchObject({ title: "No iOS Simulator on this host", message: expect.stringContaining("needs a Mac") });
    expect(iosSnapshot({ ...sampleHostIosStatus, available: false, reasonCode: "no_idb", reason: null }).reason).toContain("idb");
    expect(iosSnapshot({ ...sampleHostIosStatus, available: false, reasonCode: null, reason: "custom" }).reason).toBe("custom");
  });
});
