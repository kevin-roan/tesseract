import { lazy } from "react";
import { definePage } from "../../app/define";
import { OVERVIEW_LABELS } from "../../features/overview/labels";

export default definePage({
  id: "overview",
  title: OVERVIEW_LABELS.title,
  icon: "overview",
  section: "sandbox",
  order: 0,
  component: lazy(() => import("./OverviewPage")),
});
