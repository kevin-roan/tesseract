import { useMemo } from "react";

import { ONBOARDING_LABELS, SETUP_STEPS, setupSummary } from "../utils/content";
import { useOnboardingNavigation } from "./use-onboarding-navigation";

export function useSetupScreen() {
  const nav = useOnboardingNavigation();
  const summary = useMemo(() => setupSummary(SETUP_STEPS), []);
  return { steps: SETUP_STEPS, summary, labels: ONBOARDING_LABELS, back: nav.back, pair: nav.pair };
}
