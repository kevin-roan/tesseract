import { MotionConfig } from "motion/react";
import type { OnboardingState } from "../../../shared/contracts/onboarding";
import { SUPPORT } from "../../fixtures/onboarding-android/data";
import { fixtureOnboardingState } from "../../fixtures/onboarding-shell/state";
import { renderRoutes } from "../../test/render";
import { OnboardingShell } from "../shell";

export function androidState(patch: Partial<OnboardingState> = {}): OnboardingState {
  return { ...fixtureOnboardingState("android"), androidSupport: SUPPORT, ...patch };
}

export function renderAndroidStep() {
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
    "/onboarding/android",
  );
}
