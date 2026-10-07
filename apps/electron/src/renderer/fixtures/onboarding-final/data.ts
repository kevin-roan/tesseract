import type { HostClaudeState } from "../../../shared/contracts/claude";
import type { DockerReport } from "../../../shared/contracts/docker";
import type { OnboardingState, StepStatus } from "../../../shared/contracts/onboarding";
import type { PairingInfo, SetupChoices } from "../../../shared/contracts/sandbox";
import type { OnboardingStepId } from "../../../shared/routes";
import { currentScenario } from "../scenario";

export const ONBOARDING_FINAL_SCENARIOS = {
  claudeSignedIn: "claude-signed-in",
  claudeFolderMissing: "claude-folder-missing",
  claudeNotSignedIn: "claude-not-signed-in",
  claudeKeychain: "claude-keychain",
  pairLocal: "pair-local",
  pairError: "pair-error",
  finishSkipped: "finish-skipped",
} as const;

const HOUR_MS = 3_600_000;
export const FIXTURE_COMPLETED_AT = "2026-10-06T21:00:00.000Z";

export const FIXTURE_PAIR_LINK =
  "theone://pair?url=https%3A%2F%2Ftheone-sandbox.tail1234.ts.net&token=fixture-token-0123456789abcdef&name=theone-sandbox";

export const FIXTURE_PAIR: PairingInfo = {
  link: FIXTURE_PAIR_LINK,
  url: "https://theone-sandbox.tail1234.ts.net",
  name: "theone-sandbox",
  local: false,
};

export const FIXTURE_LOCAL_PAIR: PairingInfo = {
  link: "theone://pair?url=http%3A%2F%2F127.0.0.1%3A7700&token=fixture-token-0123456789abcdef&name=theone-sandbox",
  url: "http://127.0.0.1:7700",
  name: "theone-sandbox",
  local: true,
};

const SETTINGS = {
  settingsJson: true,
  claudeMd: true,
  skills: 2,
  agents: 0,
  commands: 0,
  outputStyles: 0,
};

export function claudeAccount(overrides: Partial<HostClaudeState> = {}): HostClaudeState {
  return {
    id: "claude",
    configDir: "/home/dev/.claude",
    primary: true,
    login: "signed-in",
    email: "you@example.com",
    displayName: "You",
    organization: "Example Org",
    subscriptionType: "max",
    expiresAt: Date.now() + 2 * HOUR_MS,
    settings: SETTINGS,
    ...overrides,
  };
}

const WORK_ACCOUNT = claudeAccount({
  id: "claude-work",
  configDir: "/home/dev/.claude-work",
  primary: false,
  email: "work@example.com",
});

export const FIXTURE_DOCKER: DockerReport = {
  cli: { path: "/usr/bin/docker", version: "29.8.1" },
  daemon: "reachable",
  daemonError: null,
  kind: "engine",
  context: "default",
  server: {
    version: "29.8.1",
    os: "linux",
    arch: "amd64",
    ncpu: 16,
    memBytes: 32 * 1024 ** 3,
    rootDir: "/var/lib/docker",
    rootless: false,
  },
  compose: "2.40.3",
  buildx: "0.29.1",
  checks: [],
};

export const FIXTURE_CHOICES: SetupChoices = {
  mode: "tailscale",
  tsAuthKey: "",
  tailnetDomain: "tail1234.ts.net",
  hostname: "theone-sandbox",
  bindAddr: "",
  components: ["android", "flutter", "mono", "whisper"],
  whisperModels: ["base", "small"],
  flutterVersion: "3.47.5",
  cpus: 4,
  memoryGb: 8,
  timeZone: "Europe/Paris",
  project: "theone",
  image: "theone/sandbox:latest",
  controllerPort: 7700,
  vncPort: 5901,
  claudeCodeVersion: "latest",
  hostClaudeDir: "/home/dev/.claude",
  dind: false,
  useExistingImage: false,
};

const DONE_STATUSES: Record<OnboardingStepId, StepStatus> = {
  welcome: "done",
  docker: "done",
  claude: "done",
  sandbox: "done",
  build: "done",
  android: "done",
  pair: "done",
  finish: "active",
};

export function fixtureOnboardingState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    step: "finish",
    statuses: DONE_STATUSES,
    host: {
      platform: "linux",
      arch: "x64",
      osVersion: "6.17.1",
      distro: {
        id: "arch",
        idLike: [],
        versionId: "rolling",
        prettyName: "Arch Linux",
      },
      cpus: 16,
      memBytes: 32 * 1024 ** 3,
      translated: false,
      homeDir: "/home/dev",
      freeDiskBytes: 220 * 1024 ** 3,
    },
    docker: FIXTURE_DOCKER,
    dockerPhase: { kind: "ready" },
    claude: [claudeAccount(), WORK_ACCOUNT],
    choices: FIXTURE_CHOICES,
    build: {
      kind: "done",
      apiUrl: FIXTURE_PAIR.url,
      imageId: "sha256:fixture",
    },
    android: {
      kind: "done",
      sdkRoot: "/home/dev/.local/share/theone/android-sdk",
      avd: "Monolith_API_36",
      warnings: [],
    },
    androidSupport: null,
    pair: FIXTURE_PAIR,
    log: { docker: [], build: [], android: [] },
    completedAt: null,
    ...overrides,
  };
}

export function scenarioClaude(scenario: string | null = currentScenario()): HostClaudeState[] {
  switch (scenario) {
    case ONBOARDING_FINAL_SCENARIOS.claudeFolderMissing:
      return [];
    case ONBOARDING_FINAL_SCENARIOS.claudeNotSignedIn:
      return [
        claudeAccount({
          login: "missing",
          email: null,
          organization: null,
          subscriptionType: null,
          expiresAt: null,
        }),
      ];
    case ONBOARDING_FINAL_SCENARIOS.claudeKeychain:
      return [
        claudeAccount({
          login: "keychain",
          subscriptionType: null,
          expiresAt: null,
        }),
      ];
    default:
      return [claudeAccount(), WORK_ACCOUNT];
  }
}

export function scenarioState(scenario: string | null = currentScenario()): OnboardingState {
  if (scenario === ONBOARDING_FINAL_SCENARIOS.finishSkipped) {
    return fixtureOnboardingState({
      statuses: {
        ...DONE_STATUSES,
        claude: "warning",
        android: "skipped",
        pair: "skipped",
      },
      claude: scenarioClaude(ONBOARDING_FINAL_SCENARIOS.claudeNotSignedIn),
      android: { kind: "idle" },
      pair: null,
    });
  }
  if (scenario === ONBOARDING_FINAL_SCENARIOS.pairLocal) {
    return fixtureOnboardingState({
      choices: { ...FIXTURE_CHOICES, mode: "local" },
      pair: FIXTURE_LOCAL_PAIR,
    });
  }
  return fixtureOnboardingState({ claude: scenarioClaude(scenario) });
}
