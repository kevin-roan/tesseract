import { lazy } from "react";
import { definePreferencesSection } from "../../../../app/define";
import { HOST_SHELL_LABELS } from "../../host-shell/labels";

export default definePreferencesSection({
  id: "host-shell",
  title: HOST_SHELL_LABELS.title,
  icon: "host",
  order: 15,
  component: lazy(() => import("../../host-shell/HostShellPreferences")),
});
