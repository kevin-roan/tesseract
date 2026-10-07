import type { ChoiceOption } from "../ChoiceDropdown/model";

export const LIST_TOOLBAR_TABS = [
  { id: "all", label: "All projects" },
  { id: "active", label: "Active", count: 3 },
  { id: "idle", label: "Idle" },
] as const;

export const LIST_TOOLBAR_FILTERS: readonly ChoiceOption[] = [
  { id: "all", label: "All projects" },
  { id: "theone", label: "theone-mobile" },
];

export const LIST_TOOLBAR_SAMPLES = {
  tabs: "Projects",
  search: "Search projects",
  group: "Group by status",
  filter: "Filter by project",
} as const;
