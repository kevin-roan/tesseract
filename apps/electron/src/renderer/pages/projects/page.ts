import { lazy } from "react";
import { definePage } from "../../app/define";
import { PROJECTS_LABELS } from "../../features/projects/labels";

export default definePage({
  id: "projects",
  title: PROJECTS_LABELS.title,
  icon: "projects",
  section: "sandbox",
  order: 20,
  component: lazy(() => import("./ProjectsPage")),
});
