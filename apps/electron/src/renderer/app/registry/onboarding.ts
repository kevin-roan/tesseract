import { ONBOARDING_STEP_IDS } from "../../../shared/routes";
import type { OnboardingStepDefinition } from "../define";

const modules = import.meta.glob<{ default: OnboardingStepDefinition }>("../../onboarding/*/step.ts", { eager: true });

export const ONBOARDING_STEPS: readonly OnboardingStepDefinition[] = Object.values(modules)
  .map((module) => module.default)
  .sort((a, b) => ONBOARDING_STEP_IDS.indexOf(a.id) - ONBOARDING_STEP_IDS.indexOf(b.id));

export function findOnboardingStep(id: string | undefined): OnboardingStepDefinition | undefined {
  return ONBOARDING_STEPS.find((step) => step.id === id);
}
