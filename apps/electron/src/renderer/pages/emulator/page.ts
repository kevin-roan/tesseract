import { lazy } from "react";
import { definePage } from "../../app/define";
import { EMULATOR_PAGE_LABELS } from "../../features/emulator/labels";

export default definePage({
  id: "emulator",
  title: EMULATOR_PAGE_LABELS.title,
  icon: "smartphone",
  section: "host",
  order: 40,
  component: lazy(() => import("./EmulatorPage")),
});
