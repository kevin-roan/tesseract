import { lazy } from "react";
import { definePreferencesSection } from "../../../../app/define";
import { SANDBOX_SETTINGS_LABELS } from "../../sandbox/labels";

export default definePreferencesSection({
  id: "sandbox",
  title: SANDBOX_SETTINGS_LABELS.title,
  icon: "sandbox",
  order: 25,
  component: lazy(() => import("../../sandbox/SandboxPreferences")),
});
