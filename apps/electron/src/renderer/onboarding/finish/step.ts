import { lazy } from "react";
import { defineOnboardingStep } from "../../app/define";
import { ONBOARDING_LABELS } from "../labels";

export default defineOnboardingStep({
  id: "finish",
  title: ONBOARDING_LABELS.titles.finish,
  railLabel: ONBOARDING_LABELS.rail.finish,
  icon: "success",
  optional: false,
  component: lazy(() => import("../done/DoneStep")),
});
