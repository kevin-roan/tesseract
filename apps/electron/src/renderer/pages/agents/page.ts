import { lazy } from "react";
import { definePage } from "../../app/define";
import { AGENTS_LABELS } from "../../features/agents/labels";

export default definePage({
  id: "agents",
  title: AGENTS_LABELS.title,
  icon: "agents",
  section: "sandbox",
  order: 10,
  component: lazy(() => import("./AgentsPage")),
});
