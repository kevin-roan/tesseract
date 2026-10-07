import { lazy } from "react";
import { definePreferencesSection } from "../../../../app/define";
import { SECTION_LABELS } from "../../claude/labels";

export default definePreferencesSection({
  id: "claude",
  title: SECTION_LABELS.title,
  icon: "agents",
  order: 10,
  component: lazy(() => import("../../claude/ClaudePreferences")),
});
