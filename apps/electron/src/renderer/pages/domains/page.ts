import { lazy } from "react";
import { definePage } from "../../app/define";
import { DOMAINS_LABELS } from "../../features/containers/labels";

export default definePage({
  id: "domains",
  title: DOMAINS_LABELS.title,
  icon: "globe",
  section: "host",
  order: 20,
  component: lazy(() => import("./DomainsPage")),
});
