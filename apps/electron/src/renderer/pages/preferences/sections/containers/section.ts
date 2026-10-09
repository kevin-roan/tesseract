import { lazy } from "react";
import { definePreferencesSection } from "../../../../app/define";
import { CONTAINERS_SETTINGS_LABELS } from "../../containers/labels";

export default definePreferencesSection({
  id: "containers",
  title: CONTAINERS_SETTINGS_LABELS.title,
  icon: "server",
  order: 17,
  component: lazy(() => import("../../containers/ContainersPreferences")),
});
