import { lazy } from "react";
import { definePreferencesSection } from "../../../../app/define";
import { SECTION_LABELS } from "../../connection/labels";

export default definePreferencesSection({
  id: "connection",
  title: SECTION_LABELS.title,
  icon: "connection",
  order: 0,
  component: lazy(() => import("../../connection/ConnectionPreferences")),
});
