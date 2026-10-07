import { lazy } from "react";
import { defineOnboardingStep } from "../../app/define";
import { ONBOARDING_LABELS } from "../labels";

export default defineOnboardingStep({
  id: "claude",
  title: ONBOARDING_LABELS.titles.claude,
  railLabel: ONBOARDING_LABELS.rail.claude,
  icon: "agents",
  optional: false,
  component: lazy(() => import("./ClaudeStep")),
});
