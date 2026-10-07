import type { OnboardingStepId } from "../../shared/routes";

export const ONBOARDING_LABELS = {
  windowTitle: "Set up Monolith",
  setUp: "Set up",
  optional: "Optional",
  stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
  version: (version: string) => `Monolith ${version}`,
  buttons: {
    getStarted: "Get started",
    continue: "Continue",
    back: "Back",
    skip: "Skip",
    cancel: "Cancel",
    retry: "Retry",
    openMonolith: "Open Monolith",
  },
  rail: {
    welcome: "Welcome",
    docker: "Docker",
    claude: "Claude Code",
    sandbox: "Sandbox",
    build: "Build",
    android: "Android emulator",
    pair: "Phone",
    finish: "Done",
  } satisfies Record<OnboardingStepId, string>,
  titles: {
    welcome: "Welcome to Monolith",
    docker: "Docker",
    claude: "Claude Code",
    sandbox: "Sandbox",
    build: "Build the sandbox",
    android: "Android emulator",
    pair: "Pair your phone",
    finish: "Monolith is ready",
  } satisfies Record<OnboardingStepId, string>,
} as const;
