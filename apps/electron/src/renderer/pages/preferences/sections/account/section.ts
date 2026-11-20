import { lazy } from "react";
import { definePreferencesSection } from "../../../../app/define";
import { ACCOUNT_LABELS } from "../../account/labels";

export default definePreferencesSection({
  id: "account",
  title: ACCOUNT_LABELS.title,
  icon: "assignee",
  order: 2,
  component: lazy(() => import("../../account/AccountPreferences")),
});
