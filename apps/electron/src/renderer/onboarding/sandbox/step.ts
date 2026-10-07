import { lazy } from "react";
import { defineOnboardingStep } from "../../app/define";
import { ONBOARDING_LABELS } from "../labels";

export default defineOnboardingStep({
  id: "sandbox",
  title: ONBOARDING_LABELS.titles.sandbox,
  railLabel: ONBOARDING_LABELS.rail.sandbox,
  icon: "sandbox",
  optional: false,
  component: lazy(() => import("./SandboxStep")),
});
