import { lazy } from "react";
import { defineOnboardingStep } from "../../app/define";
import { ONBOARDING_LABELS } from "../labels";

export default defineOnboardingStep({
  id: "docker",
  title: ONBOARDING_LABELS.titles.docker,
  railLabel: ONBOARDING_LABELS.rail.docker,
  icon: "docker",
  optional: false,
  component: lazy(() => import("./DockerStep")),
});
