import { useCallback } from "react";
import { useNavigate } from "react-router";
import { ROUTE, type OnboardingStepId } from "../../../../shared/routes";
import { ipc } from "../../../lib/ipc";
import { SETUP_ENTRY_STEP } from "./constants";

export function useOpenSetup(step: OnboardingStepId = SETUP_ENTRY_STEP): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    ipc.window.openOnboarding(step).catch(() => navigate(ROUTE.onboarding(step)));
  }, [navigate, step]);
}
