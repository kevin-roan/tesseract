import { lazy } from "react";
import { definePage } from "../../app/define";
import { CONTAINERS_LABELS } from "../../features/containers/labels";

export default definePage({
  id: "containers",
  title: CONTAINERS_LABELS.title,
  icon: "server",
  section: "host",
  order: 10,
  component: lazy(() => import("./ContainersPage")),
});
