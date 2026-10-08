import type { AppRun, HostAndroidStatus, RunTargetInfo } from "@tesseract/protocol";
import { sampleAndroidLink, sampleEmulator, sampleHostAndroidStatus } from "@tesseract/protocol/fixtures";
import type { HostShellState } from "../../../shared/contracts/hostShell";

const HOUR_MS = 3_600_000;

const androidTarget = (target: RunTargetInfo["target"], available: boolean, reason: string | null): RunTargetInfo => ({
  target,
  label: "Android emulator",
  dir: null,
  available,
  reason,
  viewer: "android",
  actions: ["reload", "restart"],
});

const webTarget: RunTargetInfo = { target: "web-dev", label: "Web", dir: null, available: true, reason: null, viewer: "url", actions: ["reload", "restart"] };

export const FIXTURE_RUN_TARGETS: Readonly<Record<string, RunTargetInfo[]>> = {
  streaxfit: [androidTarget("expo-android", false, "Start the emulator on the host"), webTarget],
  "sante-production": [androidTarget("expo-android", true, null)],
  "hybrid-pos": [{ ...webTarget, target: "electron-dev", label: "Electron", viewer: "display" }],
  tesseract: [webTarget],
};

export function liveAndroidRun(projectId: string): AppRun {
  return {
    id: "app_3m9l4t0r1x",
    projectId,
    target: "expo-android",
    dir: null,
    state: "ready",
    port: 8081,
    processIds: ["prc_4ndr01d000"],
    viewer: null,
    actions: ["reload", "restart"],
    error: null,
    startedAt: new Date(Date.now() - HOUR_MS).toISOString(),
    readyAt: new Date(Date.now() - HOUR_MS / 2).toISOString(),
    endedAt: null,
  };
}

export const hostState: HostShellState = {
  status: "running",
  pairing: { link: "tesseract://pair?fixture", url: "http://127.0.0.1:7701", name: "workstation", pinSet: true },
  error: null,
  log: [],
  autostart: true,
  sessionExpiresAt: null,
};

export const hostAndroid: HostAndroidStatus = {
  ...sampleHostAndroidStatus,
  avds: ["Pixel_8_API_35", "Pixel_Tablet_API_35"],
  emulator: { ...sampleEmulator, state: "stopped", serial: null, startedAt: null },
  link: { ...sampleAndroidLink, configured: false, sandboxUrl: null, connected: false },
};


export const PARITY_RUN_TARGETS: Readonly<Record<string, RunTargetInfo[]>> = {
  "nimble-lotus": FIXTURE_RUN_TARGETS.streaxfit!,
  "tesseract-mobile": [androidTarget("expo-android", false, "Start the emulator on the host"), webTarget],
  "sante-production": FIXTURE_RUN_TARGETS["sante-production"]!,
  "brave-hare": FIXTURE_RUN_TARGETS["hybrid-pos"]!,
};

export const PARITY_LIVE_RUN_PROJECT = "nimble-lotus";
