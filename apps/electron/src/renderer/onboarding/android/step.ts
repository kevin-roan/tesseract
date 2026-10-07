import { lazy } from "react";
import { defineOnboardingStep } from "../../app/define";
import { ONBOARDING_LABELS } from "../labels";

export default defineOnboardingStep({
  id: "android",
  title: ONBOARDING_LABELS.titles.android,
  railLabel: ONBOARDING_LABELS.rail.android,
  icon: "smartphone",
  optional: true,
  component: lazy(() => import("./AndroidStep")),
});
