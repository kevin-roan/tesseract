import type { HostShellState } from "../../../shared/contracts/hostShell";
import type { BuildPhase, SandboxStackStatus } from "../../../shared/contracts/sandbox";
import { ACCEL_OK, ANDROID_LOG, CANDIDATES, CATALOG, SUPPORT } from "../onboarding-android/data";
import { BUILD_LOG, BUILDING_PHASE, ENGINE_REPORT } from "../onboarding-sandbox/data";
import type { ServiceName } from "../../../shared/ipc";
import { currentScenario } from "../scenario";
import { defineIpcFixtures } from "../types";
import {
  cliStatus,
  emulatorState,
  hostShellState,
  isPreferencesRoute,
  SANDBOX_LOG,
  SANDBOX_STACK,
  sandboxStatus,
  SETTINGS_AVDS,
  SETTINGS_CHOICES,
  SETTINGS_SCENARIOS,
  UNCONFIGURED_STATUS,
  updateState,
} from "./data";

export const SCENARIOS = SETTINGS_SCENARIOS;

let host: HostShellState | null = null;

function emit(service: ServiceName, event: string, payload: unknown): void {
  void import("../registry").then(({ emitFixtureEvent }) => emitFixtureEvent(service, event, payload));
}
let stack: SandboxStackStatus | null = null;

function hostState(): HostShellState {
  host ??= hostShellState(currentScenario());
  return host;
}

function publishHost(patch: Partial<HostShellState>): HostShellState {
  host = { ...hostState(), ...patch };
  emit("hostShell", "state", host);
  return host;
}

function stackStatus(): SandboxStackStatus {
  if (stack) return stack;
  const scenario = currentScenario();
  if (scenario === SETTINGS_SCENARIOS.sandboxUnconfigured) return UNCONFIGURED_STATUS;
  return sandboxStatus(scenario !== SETTINGS_SCENARIOS.sandboxStopped);
}

function buildPhase(): BuildPhase {
  return currentScenario() === SETTINGS_SCENARIOS.sandboxBuilding ? BUILDING_PHASE : { kind: "idle" };
}

export function resetSettingsFixture(): void {
  host = null;
  stack = null;
}

const fixtures = defineIpcFixtures({
  hostShell: {
    state: () => hostState(),
    refresh: () => hostState(),
    start: () => publishHost({ status: "running", error: null }),
    stop: () => publishHost({ status: "stopped" }),
    setAutostart: (autostart) => publishHost({ autostart }),
    setPin: () => publishHost({ pairing: hostState().pairing ? { ...hostState().pairing!, pinSet: true } : null }),
    rotateToken: () => hostState(),
  },
  docker: {
    check: () => ENGINE_REPORT,
  },
  sandbox: {
    defaults: () => SETTINGS_CHOICES,
    stack: () => (currentScenario() === SETTINGS_SCENARIOS.sandboxUnconfigured ? null : SANDBOX_STACK),
    status: () => stackStatus(),
    phase: () => buildPhase(),
    logs: () => [...SANDBOX_LOG],
    save: (choices) => ({ ...SANDBOX_STACK, components: choices.components }),
    build: () => {
      for (const line of BUILD_LOG) emit("sandbox", "log", line);
      emit("sandbox", "phase", BUILDING_PHASE);
      return BUILDING_PHASE;
    },
    cancel: () => ({ kind: "cancelled" }),
    up: () => {
      stack = sandboxStatus(true);
      return stack;
    },
    down: () => {
      stack = sandboxStatus(false);
      return stack;
    },
  },
  android: {
    support: () => SUPPORT,
    sdkCandidates: () => CANDIDATES,
    catalog: () => CATALOG,
    accel: () => ACCEL_OK,
    avds: () => SETTINGS_AVDS,
    emulator: () => emulatorState(currentScenario()),
    startEmulator: (_root, avd) => ({ kind: "running", avd, serial: "emulator-5554" }),
    stopEmulator: () => ({ kind: "stopped" }),
    deleteAvd: () => undefined,
    acceptLicense: () => undefined,
    install: () => undefined,
    cancel: () => undefined,
    log: () => [...ANDROID_LOG],
  },
  updates: {
    state: () => updateState(currentScenario()),
    check: () => updateState(currentScenario()),
    download: () => updateState(SETTINGS_SCENARIOS.updateDownloading),
    install: () => undefined,
  },
  app: {
    cliStatus: () => cliStatus(currentScenario()),
    installCli: () => cliStatus(SETTINGS_SCENARIOS.cliInstalled),
  },
});

export default isPreferencesRoute() ? fixtures : defineIpcFixtures({});

export { fixtures as settingsFixtures };
