import type { OnboardingState, StepStatus } from "../../../shared/contracts/onboarding";
import type { BuildMode, BuildPhase, ExistingSandbox, SetupChoices } from "../../../shared/contracts/sandbox";
import type { OnboardingStepId } from "../../../shared/routes";
import shellFixtures from "../onboarding-shell/ipc";
import { emitFixtureEvent } from "../registry";
import { currentScenario, isScenario } from "../scenario";
import { defineIpcFixtures } from "../types";
import {
  BUILD_LOG,
  BUILDING_PHASE,
  DESKTOP_REPORT,
  DONE_PHASE,
  ENGINE_REPORT,
  EXISTING_RUNNING,
  EXISTING_STOPPED,
  FAILED_PHASE,
  IMAGE_ONLY,
  NO_EXISTING,
  SANDBOX_SCENARIOS,
  SIMULATED_STEPS,
  SIMULATED_TOTAL_STEPS,
  SIMULATION_TICK_MS,
  validateFixtureChoices,
} from "./data";

export const SCENARIOS = SANDBOX_SCENARIOS;

const LOW_DISK_BYTES = 23e9;
const WAITING_ELAPSED_MS = 34_000;
const TAILSCALE_IP = "100.101.102.103";

interface Overlay {
  choices?: SetupChoices;
  build?: BuildPhase;
  buildLog?: string[];
  statuses?: Partial<Record<OnboardingStepId, StepStatus>>;
}

let overlay: Overlay = {};
let timers: ReturnType<typeof setTimeout>[] = [];

function sandboxScenario(): boolean {
  return currentScenario()?.startsWith("sandbox") ?? false;
}

function scenarioBuild(): Pick<OnboardingState, "build"> & { log?: string[] } {
  if (isScenario(SANDBOX_SCENARIOS.building)) return { build: BUILDING_PHASE, log: [...BUILD_LOG] };
  if (isScenario(SANDBOX_SCENARIOS.waiting))
    return {
      build: { kind: "waiting", since: Date.now() - WAITING_ELAPSED_MS },
      log: [...BUILD_LOG],
    };
  if (isScenario(SANDBOX_SCENARIOS.failed)) {
    return {
      build: FAILED_PHASE,
      log: [...BUILD_LOG, "theone-sandbox-1  | controller: waiting for /home/dev/.claude", "health: timed out after 180 s"],
    };
  }
  if (isScenario(SANDBOX_SCENARIOS.done))
    return {
      build: DONE_PHASE,
      log: [...BUILD_LOG, "#24 DONE 0.4s", "Controller healthy at http://127.0.0.1:7700"],
    };
  return { build: { kind: "idle" } };
}

function scenarioPatch(state: OnboardingState): OnboardingState {
  if (!sandboxScenario()) return state;
  const desktop = isScenario(SANDBOX_SCENARIOS.desktop);
  const host = isScenario(SANDBOX_SCENARIOS.lowDisk) ? { ...state.host, freeDiskBytes: LOW_DISK_BYTES } : state.host;
  const { build, log } = scenarioBuild();
  const choices = isScenario(SANDBOX_SCENARIOS.tailscale)
    ? {
        ...state.choices,
        mode: "tailscale" as const,
        tailnetDomain: "tail1234",
        tsAuthKey: "",
      }
    : state.choices;
  return {
    ...state,
    step: "sandbox",
    host,
    docker: desktop ? DESKTOP_REPORT : ENGINE_REPORT,
    choices,
    build,
    log: { ...state.log, build: log ?? state.log.build },
  };
}

async function baseState(): Promise<OnboardingState> {
  const get = shellFixtures.onboarding?.get;
  if (!get) throw new Error("onboarding-shell fixtures are missing onboarding.get");
  return scenarioPatch(await get());
}

async function merged(): Promise<OnboardingState> {
  const base = await baseState();
  return {
    ...base,
    choices: overlay.choices ?? base.choices,
    build: overlay.build ?? base.build,
    statuses: { ...base.statuses, ...overlay.statuses },
    log: { ...base.log, build: overlay.buildLog ?? base.log.build },
  };
}

async function publish(patch: Overlay): Promise<OnboardingState> {
  overlay = {
    ...overlay,
    ...patch,
    statuses: { ...overlay.statuses, ...patch.statuses },
  };
  const state = await merged();
  emitFixtureEvent("onboarding", "state", state);
  return state;
}

function clearTimers(): void {
  timers.forEach(clearTimeout);
  timers = [];
}

function schedule(delayMs: number, run: () => void): void {
  timers.push(setTimeout(run, delayMs));
}

function simulate(mode: BuildMode): void {
  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(line);
    return [...lines];
  };
  const steps = mode === "existing" ? [] : SIMULATED_STEPS;
  let tick = 1;
  steps.forEach((step, index) => {
    const fraction = (index + 1) / (steps.length + 1);
    schedule(SIMULATION_TICK_MS * tick++, () => {
      const phase: BuildPhase =
        mode === "pull"
          ? {
              kind: "pulling",
              fraction,
              detail: `Downloading layer ${index + 1} of ${steps.length}`,
            }
          : {
              kind: "building",
              fraction,
              step,
              cachedSteps: 0,
              doneSteps: Math.round(fraction * SIMULATED_TOTAL_STEPS),
              totalSteps: SIMULATED_TOTAL_STEPS,
            };
      void publish({ build: phase, buildLog: log(`#${index + 3} ${step}`) });
    });
  });
  schedule(
    SIMULATION_TICK_MS * tick++,
    () =>
      void publish({
        build: { kind: "starting" },
        buildLog: log("$ docker compose up --detach"),
      }),
  );
  schedule(
    SIMULATION_TICK_MS * tick++,
    () =>
      void publish({
        build: { kind: "waiting", since: Date.now() },
        buildLog: log("Waiting for /v1/health"),
      }),
  );
  if (isScenario(SANDBOX_SCENARIOS.simulateFailure)) {
    schedule(
      SIMULATION_TICK_MS * tick++,
      () =>
        void publish({
          build: FAILED_PHASE,
          buildLog: log("health: timed out after 180 s"),
        }),
    );
    return;
  }
  schedule(
    SIMULATION_TICK_MS * tick++,
    () =>
      void publish({
        build: { kind: "pairing" },
        buildLog: log("$ theone-controller pair --json"),
      }),
  );
  schedule(
    SIMULATION_TICK_MS * tick++,
    () =>
      void publish({
        build: DONE_PHASE,
        statuses: { sandbox: "done", build: "done" },
        buildLog: log("Sandbox ready"),
      }),
  );
}

function existingSandbox(): ExistingSandbox {
  if (isScenario(SANDBOX_SCENARIOS.existingRunning)) return EXISTING_RUNNING;
  if (isScenario(SANDBOX_SCENARIOS.existingStopped)) return EXISTING_STOPPED;
  if (isScenario(SANDBOX_SCENARIOS.imageOnly)) return IMAGE_ONLY;
  return NO_EXISTING;
}

export function resetSandboxFixture(): void {
  clearTimers();
  overlay = {};
}

export default defineIpcFixtures({
  onboarding: {
    get: () => merged(),
    sandboxSave: (choices) => publish({ choices }),
    buildStart: (mode) => {
      clearTimers();
      simulate(mode);
      return publish({ build: { kind: "preflight" }, buildLog: [] });
    },
    buildCancel: () => {
      clearTimers();
      return publish({ build: { kind: "cancelled" } });
    },
  },
  sandbox: {
    existing: () => existingSandbox(),
    defaults: async () => ({
      ...(await baseState()).choices,
      bindAddr: TAILSCALE_IP,
    }),
    validate: (choices) => validateFixtureChoices(choices),
  },
});
