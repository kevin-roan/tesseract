import { lazy } from "react";
import { definePreferencesSection } from "../../../../app/define";
import { SECTION_LABELS } from "../../appearance/labels";

export default definePreferencesSection({
  id: "appearance",
  title: SECTION_LABELS.title,
  icon: "appearance",
  order: 5,
  component: lazy(() => import("../../appearance/AppearancePreferences")),
});
