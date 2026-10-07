import { lazy } from "react";
import { definePage } from "../../app/define";
import { TERMINALS_LABELS } from "../../features/terminals/labels";

export default definePage({
  id: "terminals",
  title: TERMINALS_LABELS.title,
  icon: "terminal",
  section: "sandbox",
  order: 30,
  component: lazy(() => import("./TerminalsPage")),
});
