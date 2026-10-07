import { lazy } from "react";
import { defineOnboardingStep } from "../../app/define";
import { ONBOARDING_LABELS } from "../labels";

export default defineOnboardingStep({
  id: "pair",
  title: ONBOARDING_LABELS.titles.pair,
  railLabel: ONBOARDING_LABELS.rail.pair,
  icon: "pair",
  optional: true,
  component: lazy(() => import("./PairStep")),
});
