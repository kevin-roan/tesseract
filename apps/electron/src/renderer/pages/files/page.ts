import { lazy } from "react";
import { definePage } from "../../app/define";
import { FILES_LABELS } from "../../features/files/labels";

export default definePage({
  id: "files",
  title: FILES_LABELS.title,
  icon: "files",
  section: "sandbox",
  order: 25,
  component: lazy(() => import("./FilesPage")),
});
