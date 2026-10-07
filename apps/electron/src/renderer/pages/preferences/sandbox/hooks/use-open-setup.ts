import { useCallback } from "react";
import type { OnboardingStepId } from "../../../../../shared/routes";
import { ipc } from "../../../../lib/ipc";

export function useOpenSetup() {
  return useCallback((step: OnboardingStepId) => {
    ipc.window.openOnboarding(step).catch(() => undefined);
  }, []);
}
