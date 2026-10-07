import { lazy } from "react";
import { definePage } from "../../app/define";
import { DISPLAY_LABELS } from "../../features/display/labels";

export default definePage({
  id: "display",
  title: DISPLAY_LABELS.title,
  icon: "display",
  section: "sandbox",
  order: 40,
  component: lazy(() => import("./DisplayPage")),
});
