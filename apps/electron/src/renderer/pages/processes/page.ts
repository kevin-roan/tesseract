import { lazy } from "react";
import { definePage } from "../../app/define";
import { PROCESSES_LABELS } from "../../features/processes/labels";

export default definePage({
  id: "processes",
  title: PROCESSES_LABELS.title,
  icon: "activity",
  section: "sandbox",
  order: 50,
  component: lazy(() => import("./ProcessesPage")),
});
