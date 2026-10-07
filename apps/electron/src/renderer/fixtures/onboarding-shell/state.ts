import type { HostInfo, OnboardingState } from "../../../shared/contracts/onboarding";
import type { SetupChoices } from "../../../shared/contracts/sandbox";
import { ONBOARDING_STEP_IDS, type OnboardingStepId } from "../../../shared/routes";
import { isScenario } from "../scenario";

const GIB = 1024 ** 3;

export const SHELL_SCENARIOS = {
  progress: "onboarding-progress",
  lowSpecs: "welcome-low-specs",
} as const;

const HOST: HostInfo = {
  platform: "linux",
  arch: "x64",
  osVersion: "6.17.2",
  distro: { id: "arch", idLike: [], versionId: "rolling", prettyName: "Arch Linux" },
  cpus: 16,
  memBytes: 32 * GIB,
  translated: false,
  homeDir: "/home/dev",
  freeDiskBytes: 412 * GIB,
};

const LOW_HOST: HostInfo = {
  ...HOST,
  arch: "arm64",
  cpus: 4,
  memBytes: 8 * GIB,
  freeDiskBytes: 23 * GIB,
};

const CHOICES: SetupChoices = {
  mode: "local",
  tsAuthKey: "",
  tailnetDomain: "",
  hostname: "theone-sandbox",
  bindAddr: "",
  components: ["android", "flutter", "mono", "whisper"],
  whisperModels: ["base", "small"],
  flutterVersion: "3.47.5",
  cpus: 4,
  memoryGb: 8,
  timeZone: "UTC",
  project: "theone",
  image: "theone/sandbox:latest",
  controllerPort: 7700,
  vncPort: 5901,
  claudeCodeVersion: "latest",
  hostClaudeDir: "/home/dev/.claude",
  dind: false,
  useExistingImage: false,
};

function statuses(step: OnboardingStepId): OnboardingState["statuses"] {
  const progress = isScenario(SHELL_SCENARIOS.progress);
  return Object.fromEntries(
    ONBOARDING_STEP_IDS.map((id) => {
      if (id === step) return [id, "active"];
      if (!progress) return [id, "pending"];
      if (id === "welcome" || id === "docker") return [id, "done"];
      if (id === "claude") return [id, "warning"];
      return [id, "pending"];
    }),
  ) as OnboardingState["statuses"];
}

export function fixtureOnboardingState(step: OnboardingStepId = "welcome"): OnboardingState {
  return {
    step,
    statuses: statuses(step),
    host: isScenario(SHELL_SCENARIOS.lowSpecs) ? LOW_HOST : HOST,
    docker: null,
    dockerPhase: { kind: "idle" },
    claude: null,
    choices: CHOICES,
    build: { kind: "idle" },
    android: { kind: "idle" },
    androidSupport: null,
    pair: null,
    log: { docker: [], build: [], android: [] },
    completedAt: null,
  };
}
