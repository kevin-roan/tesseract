import { useMemo, useState } from "react";

import { DEFAULT_SETUP_MODE, ONBOARDING_LABELS, SETUP_MODES, SETUP_STEPS, setupSummary, type SetupMode } from "../utils/content";
import { useOnboardingNavigation } from "./use-onboarding-navigation";

export function useSetupScreen() {
  const nav = useOnboardingNavigation();
  const [mode, setMode] = useState<SetupMode>(DEFAULT_SETUP_MODE);
  const steps = SETUP_STEPS[mode];
  const summary = useMemo(() => setupSummary(steps), [steps]);
  return { mode, modes: SETUP_MODES, setMode, steps, summary, labels: ONBOARDING_LABELS, back: nav.back, pair: nav.pair };
}
