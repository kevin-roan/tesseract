import { lazy } from "react";
import { definePage } from "../../app/define";
import { SHELL_LABELS } from "../../features/shell/labels";

export default definePage({
  id: "shell",
  title: SHELL_LABELS.title,
  icon: "terminal",
  section: "host",
  order: 30,
  component: lazy(() => import("./ShellPage")),
});
