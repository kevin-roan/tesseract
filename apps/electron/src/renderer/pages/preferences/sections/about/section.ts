import { lazy } from "react";
import { definePreferencesSection } from "../../../../app/define";
import { ABOUT_LABELS } from "../../about/labels";

export default definePreferencesSection({
  id: "about",
  title: ABOUT_LABELS.title,
  icon: "info",
  order: 40,
  component: lazy(() => import("../../about/AboutPreferences")),
});
