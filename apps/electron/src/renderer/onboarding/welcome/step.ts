import { lazy } from "react";
import { defineOnboardingStep } from "../../app/define";
import { ONBOARDING_LABELS } from "../labels";

export default defineOnboardingStep({
  id: "welcome",
  title: ONBOARDING_LABELS.titles.welcome,
  railLabel: ONBOARDING_LABELS.rail.welcome,
  icon: "whats-new",
  optional: false,
  component: lazy(() => import("./WelcomeStep")),
});
