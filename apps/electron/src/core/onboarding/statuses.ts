import type { OnboardingState, StepStatus } from "../../shared/contracts/onboarding";
import { ONBOARDING_STEP_ALIASES as STEP_ALIASES, ONBOARDING_STEP_IDS, type OnboardingStepId } from "../../shared/routes";
import { isDockerReady } from "../docker";

const RUNNING_BUILD: readonly OnboardingState["build"]["kind"][] = ["preflight", "building", "pulling", "starting", "waiting", "pairing"];
const RUNNING_ANDROID: readonly OnboardingState["android"]["kind"][] = ["loading-catalog", "licenses", "installing", "accel", "creating-avd"];

export function canonicalStep(step: OnboardingStepId): OnboardingStepId {
  return STEP_ALIASES[step] ?? step;
}

function buildStatus(build: OnboardingState["build"]): StepStatus | null {
  if (build.kind === "done") return "done";
  if (build.kind === "failed") return "error";
  if (RUNNING_BUILD.includes(build.kind)) return "running";
  return null;
}

export function derivedStatus(id: OnboardingStepId, state: OnboardingState, platform: NodeJS.Platform): StepStatus | null {
  switch (id) {
    case "welcome":
      return ONBOARDING_STEP_IDS.indexOf(canonicalStep(state.step)) > 0 ? "done" : null;
    case "docker":
      if (state.docker && isDockerReady(state.docker, platform)) return "done";
      if (state.dockerPhase.kind === "installing" || state.dockerPhase.kind === "starting") return "running";
      if (state.dockerPhase.kind === "needs-relogin" || state.dockerPhase.kind === "needs-reboot") return "warning";
      return state.dockerPhase.kind === "blocked" ? "error" : null;
    case "claude": {
      if (!state.claude) return null;
      return state.claude.some((account) => account.primary && account.login === "signed-in") ? "done" : "warning";
    }
    case "sandbox":
    case "build":
      return buildStatus(state.build);
    case "android":
      if (state.android.kind === "done") return state.android.warnings.length > 0 ? "warning" : "done";
      if (state.android.kind === "failed") return "error";
      return RUNNING_ANDROID.includes(state.android.kind) ? "running" : null;
    case "pair":
      return state.pair ? "done" : null;
    case "finish":
      return state.completedAt ? "done" : null;
  }
}

export function resolveStatuses(
  state: OnboardingState,
  skipped: ReadonlySet<OnboardingStepId>,
  platform: NodeJS.Platform,
): Record<OnboardingStepId, StepStatus> {
  const current = canonicalStep(state.step);
  return Object.fromEntries(
    ONBOARDING_STEP_IDS.map((id) => {
      const derived = derivedStatus(id, state, platform);
      if (derived === "done" || derived === "running" || derived === "error") return [id, derived];
      if (skipped.has(id)) return [id, "skipped"];
      if (derived) return [id, derived];
      return [id, canonicalStep(id) === current ? "active" : "pending"];
    }),
  ) as Record<OnboardingStepId, StepStatus>;
}

export function nextStep(step: OnboardingStepId): OnboardingStepId {
  const ids = ONBOARDING_STEP_IDS.filter((id) => !STEP_ALIASES[id]);
  const index = ids.indexOf(canonicalStep(step));
  return ids[Math.min(index + 1, ids.length - 1)] ?? step;
}
