import type { OnboardingStepId } from "../../shared/routes";

export const ONBOARDING_LABELS = {
  windowTitle: "Set up Tesseract",
  setUp: "Set up",
  optional: "Optional",
  stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
  version: (version: string) => `Tesseract ${version}`,
  buttons: {
    getStarted: "Get started",
    continue: "Continue",
    back: "Back",
    skip: "Skip",
    cancel: "Cancel",
    retry: "Retry",
    openTesseract: "Open Tesseract",
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
    welcome: "Welcome to Tesseract",
    docker: "Docker",
    claude: "Claude Code",
    sandbox: "Sandbox",
    build: "Build the sandbox",
    android: "Android emulator",
    pair: "Pair your phone",
    finish: "Tesseract is ready",
  } satisfies Record<OnboardingStepId, string>,
} as const;
