import { MotionConfig } from "motion/react";
import type { OnboardingState } from "../../../shared/contracts/onboarding";
import { ENGINE_REPORT } from "../../fixtures/onboarding-sandbox/data";
import { fixtureOnboardingState } from "../../fixtures/onboarding-shell/state";
import { renderRoutes } from "../../test/render";
import { OnboardingShell } from "../shell";

export function sandboxState(patch: Partial<OnboardingState> = {}): OnboardingState {
  return {
    ...fixtureOnboardingState("sandbox"),
    docker: ENGINE_REPORT,
    ...patch,
  };
}

export function renderSandboxStep() {
  return renderRoutes(
    [
      {
        path: "/onboarding/:step?",
        element: (
          <MotionConfig reducedMotion="always" skipAnimations>
            <OnboardingShell />
          </MotionConfig>
        ),
      },
    ],
    "/onboarding/sandbox",
  );
}
