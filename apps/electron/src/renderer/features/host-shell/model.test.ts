import { sampleHostIosStatus, sampleSimDevice } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import type { HostShellState } from "../../../shared/contracts/hostShell";
import { emulatorBusy, hostAccess, hostGate, sessionLive, sessionRefreshDelay, simulatorBusy } from "./model";

const NOW = 1_000_000;
const state = (patch: Partial<HostShellState> = {}): HostShellState => ({
  status: "running",
  pairing: { link: "tesseract://host", url: "http://127.0.0.1:7701", name: "box", pinSet: true },
  error: null,
  log: [],
  autostart: false,
  sessionExpiresAt: NOW + 600_000,
  ...patch,
});

describe("hostAccess", () => {
  it("maps daemon states", () => {
    expect(hostAccess(null, NOW)).toBe("loading");
    expect(hostAccess(state({ status: "stopped" }), NOW)).toBe("stopped");
    expect(hostAccess(state({ status: "stopping" }), NOW)).toBe("stopped");
    expect(hostAccess(state({ status: "starting" }), NOW)).toBe("starting");
    expect(hostAccess(state({ status: "failed" }), NOW)).toBe("failed");
  });

  it("needs a host, a PIN and a live session", () => {
    expect(hostAccess(state({ pairing: null }), NOW)).toBe("noHost");
    expect(hostAccess(state({ pairing: { link: "", url: "http://x", name: "x", pinSet: false } }), NOW)).toBe("noPin");
    expect(hostAccess(state({ sessionExpiresAt: null }), NOW)).toBe("locked");
    expect(hostAccess(state({ sessionExpiresAt: NOW + 10_000 }), NOW)).toBe("locked");
    expect(hostAccess(state({ status: "external" }), NOW)).toBe("ready");
  });
});

describe("hostGate", () => {
  it("has no gate when ready", () => {
    expect(hostGate("ready")).toBeNull();
  });

  it("offers unlock and settings while locked", () => {
    expect(hostGate("locked")).toMatchObject({ action: "unlock", actionLabel: "Unlock", secondary: "preferences", loading: false });
  });

  it("starts a stopped daemon and shows the failure message", () => {
    expect(hostGate("stopped")).toMatchObject({ action: "start", actionLabel: "Start host shell" });
    expect(hostGate("failed", "EADDRINUSE")).toMatchObject({ message: "EADDRINUSE", action: "preferences" });
    expect(hostGate("starting")).toMatchObject({ loading: true, action: null });
    expect(hostGate("noHost")).toMatchObject({ title: "No host shell for this machine", action: "preferences", loading: false });
  });
});

describe("session timing", () => {
  it("applies the safety margin", () => {
    expect(sessionLive(state({ sessionExpiresAt: NOW + 31_000 }), NOW)).toBe(true);
    expect(sessionLive(state({ sessionExpiresAt: NOW + 29_000 }), NOW)).toBe(false);
    expect(sessionRefreshDelay(NOW + 40_000, NOW)).toBe(10_000);
    expect(sessionRefreshDelay(NOW, NOW)).toBeNull();
    expect(sessionRefreshDelay(null, NOW)).toBeNull();
  });

  it("polls faster while the emulator changes state", () => {
    expect(emulatorBusy(null)).toBe(false);
    expect(simulatorBusy(null)).toBe(false);
    expect(simulatorBusy(sampleHostIosStatus)).toBe(false);
    expect(simulatorBusy({ ...sampleHostIosStatus, devices: [{ ...sampleSimDevice, state: "booting" }] })).toBe(true);
  });
});
