import { ONBOARDING_LABELS, SETUP_STEPS } from "../utils/content";
import { useOnboardingNavigation } from "./use-onboarding-navigation";

export function useSetupScreen() {
  const nav = useOnboardingNavigation();
  return { steps: SETUP_STEPS, labels: ONBOARDING_LABELS, back: nav.back, pair: nav.pair };
}
