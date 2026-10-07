import { lazy } from "react";
import { definePreferencesSection } from "../../../../app/define";
import { SECTION_LABELS } from "../../stt/labels";

export default definePreferencesSection({
  id: "stt",
  title: SECTION_LABELS.title,
  icon: "microphone",
  order: 20,
  component: lazy(() => import("../../stt/SttPreferences")),
});
