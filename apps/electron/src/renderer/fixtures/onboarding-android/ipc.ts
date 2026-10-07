import type { AndroidHostSupport, InstallPlan } from "../../../shared/contracts/android";
import type { AndroidPhase, OnboardingState } from "../../../shared/contracts/onboarding";
import { IpcError } from "../../../shared/ipc-types";
import shellFixtures from "../onboarding-shell/ipc";
import { emitFixtureEvent } from "../registry";
import { currentScenario, isScenario } from "../scenario";
import { defineIpcFixtures } from "../types";
import {
  ACCEL_DENIED,
  ACCEL_OK,
  ANDROID_LOG,
  ANDROID_SCENARIOS,
  AVDS,
  CANDIDATES,
  CATALOG,
  MAC_SUPPORT,
  SDK_ROOT,
  SIMULATION_STEPS,
  SIMULATION_TICK_MS,
  SUPPORT,
  UNSUPPORTED,
} from "./data";

export const SCENARIOS = ANDROID_SCENARIOS;

const CATALOG_ERROR = "getaddrinfo ENOTFOUND dl.google.com";
const CHECKSUM_ERROR = "system-images;android-36;google_apis;x86_64: the download is corrupt (checksum mismatch)";
const INSTALLING_RECEIVED = 213_400_000;
const INSTALLING_RATE = 18_200_000;
const LICENSE_PENDING = ["android-sdk-license", "android-sdk-preview-license"];

interface Overlay {
  android?: AndroidPhase;
  log?: string[];
}

let overlay: Overlay = {};
let timers: ReturnType<typeof setTimeout>[] = [];
const accepted = new Set<string>();
let plan: InstallPlan | null = null;

function androidScenario(): boolean {
  return currentScenario()?.startsWith("android-") ?? false;
}

function support(): AndroidHostSupport {
  return isScenario(ANDROID_SCENARIOS.unsupported) ? UNSUPPORTED : SUPPORT;
}

function scenarioPhase(): AndroidPhase {
  if (isScenario(ANDROID_SCENARIOS.unsupported)) return { kind: "unsupported", reason: UNSUPPORTED.reason };
  if (isScenario(ANDROID_SCENARIOS.licenses)) return { kind: "licenses", pending: LICENSE_PENDING };
  if (isScenario(ANDROID_SCENARIOS.failed)) return { kind: "failed", message: CHECKSUM_ERROR };
  if (isScenario(ANDROID_SCENARIOS.done) || isScenario(ANDROID_SCENARIOS.doneMac)) {
    return { kind: "done", sdkRoot: SDK_ROOT, avd: "Monolith_API_36", warnings: [] };
  }
  if (isScenario(ANDROID_SCENARIOS.installing)) {
    return {
      kind: "installing",
      pkg: CATALOG.emulator.path,
      index: 1,
      count: 3,
      stage: "downloading",
      received: INSTALLING_RECEIVED,
      total: CATALOG.emulator.archive.size,
      bytesPerSecond: INSTALLING_RATE,
    };
  }
  return { kind: "choosing" };
}

async function base(): Promise<OnboardingState> {
  const get = shellFixtures.onboarding?.get;
  if (!get) throw new Error("onboarding-shell fixtures are missing onboarding.get");
  const state = await get();
  if (!androidScenario()) return { ...state, androidSupport: SUPPORT };
  const mac = isScenario(ANDROID_SCENARIOS.doneMac);
  return {
    ...state,
    step: "android",
    host: mac ? { ...state.host, platform: "darwin", arch: "arm64" } : state.host,
    android: scenarioPhase(),
    androidSupport: mac ? MAC_SUPPORT : support(),
    log: { ...state.log, android: isScenario(ANDROID_SCENARIOS.installing) || isScenario(ANDROID_SCENARIOS.failed) ? [...ANDROID_LOG] : [] },
  };
}

async function merged(): Promise<OnboardingState> {
  const state = await base();
  return {
    ...state,
    android: overlay.android ?? state.android,
    log: { ...state.log, android: overlay.log ?? state.log.android },
  };
}

async function publish(patch: Overlay): Promise<OnboardingState> {
  overlay = { ...overlay, ...patch };
  const state = await merged();
  emitFixtureEvent("onboarding", "state", state);
  return state;
}

function clearTimers(): void {
  timers.forEach(clearTimeout);
  timers = [];
}

function pendingLicenses(next: InstallPlan): string[] {
  const packages = [CATALOG.emulator, CATALOG.platformTools, ...CATALOG.systemImages];
  const ids = next.packages.map((path) => packages.find((pkg) => pkg.path === path)?.licenseId ?? null);
  return [...new Set(ids.filter((id): id is string => id !== null && !accepted.has(id)))];
}

function simulate(next: InstallPlan): void {
  clearTimers();
  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(line);
    return [...lines];
  };
  const packages = [CATALOG.emulator, CATALOG.platformTools, ...CATALOG.systemImages];
  let tick = 1;
  const at = (run: () => void) => timers.push(setTimeout(run, SIMULATION_TICK_MS * tick++));
  next.packages.forEach((path, index) => {
    const total = packages.find((pkg) => pkg.path === path)?.archive.size ?? 0;
    for (let step = 1; step <= SIMULATION_STEPS; step += 1) {
      const received = Math.round((total * step) / SIMULATION_STEPS);
      at(() => void publish({ android: { kind: "installing", pkg: path, index, count: next.packages.length, stage: "downloading", received, total, bytesPerSecond: INSTALLING_RATE }, log: log(`${path}: ${received} of ${total} bytes`) }));
    }
    at(() => void publish({ android: { kind: "installing", pkg: path, index, count: next.packages.length, stage: "verifying", received: total, total, bytesPerSecond: null }, log: log(`${path}: sha1 ok`) }));
    at(() => void publish({ android: { kind: "installing", pkg: path, index, count: next.packages.length, stage: "extracting", received: 0, total: 0, bytesPerSecond: null }, log: log(`${path}: extracting`) }));
  });
  at(() => void publish({ android: { kind: "accel", result: ACCEL_OK }, log: log("emulator -accel-check: 0 KVM (version 12) is installed and usable.") }));
  if (next.avd) {
    const name = next.avd.name;
    at(() => void publish({ android: { kind: "creating-avd" }, log: log(`Writing ${name}.ini and ${name}.avd/config.ini`) }));
  }
  at(() => void publish({ android: { kind: "done", sdkRoot: next.sdkRoot, avd: next.avd?.name ?? AVDS[0]?.name ?? "", warnings: [] }, log: log("Android emulator ready") }));
}

export function resetAndroidFixture(): void {
  clearTimers();
  overlay = {};
  accepted.clear();
  plan = null;
}

export default defineIpcFixtures({
  onboarding: {
    ...(androidScenario() ? { get: () => merged() } : {}),
    androidCatalog: () => {
      if (isScenario(ANDROID_SCENARIOS.catalogError)) throw new IpcError("unavailable", CATALOG_ERROR);
      return CATALOG;
    },
    androidInstall: (next) => {
      plan = next;
      const pending = pendingLicenses(next);
      if (pending.length > 0) return publish({ android: { kind: "licenses", pending } });
      simulate(next);
      return publish({ android: { kind: "installing", pkg: next.packages[0] ?? "", index: 0, count: next.packages.length, stage: "downloading", received: 0, total: 0, bytesPerSecond: null }, log: [] });
    },
    androidAcceptLicense: async (id) => {
      accepted.add(id);
      const state = await merged();
      if (state.android.kind !== "licenses") return state;
      const pending = state.android.pending.filter((item) => !accepted.has(item));
      if (pending.length > 0 || !plan) return publish({ android: { kind: "licenses", pending } });
      simulate(plan);
      return publish({ android: { kind: "installing", pkg: plan.packages[0] ?? "", index: 0, count: plan.packages.length, stage: "downloading", received: 0, total: 0, bytesPerSecond: null }, log: [] });
    },
    androidCancel: () => {
      clearTimers();
      return publish({ android: { kind: "cancelled" } });
    },
  },
  android: {
    support: () => support(),
    sdkCandidates: () => CANDIDATES,
    catalog: () => CATALOG,
    accel: () => (isScenario(ANDROID_SCENARIOS.kvmDenied) ? ACCEL_DENIED : ACCEL_OK),
    avds: () => (isScenario(ANDROID_SCENARIOS.done) || isScenario(ANDROID_SCENARIOS.doneMac) ? AVDS : []),
    acceptLicense: () => undefined,
    cancel: () => undefined,
    log: () => [...ANDROID_LOG],
  },
});
