import { lazy } from "react";
import { definePreferencesSection } from "../../../../app/define";
import { ANDROID_SETTINGS_LABELS } from "../../android/labels";

export default definePreferencesSection({
  id: "android",
  title: ANDROID_SETTINGS_LABELS.title,
  icon: "smartphone",
  order: 30,
  component: lazy(() => import("../../android/AndroidPreferences")),
});
