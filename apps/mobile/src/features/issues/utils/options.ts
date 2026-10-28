import { ISSUE_PRIORITIES, ISSUE_STATUSES, type IssuePriority, type IssueStatus } from "@tesseract/protocol";

import type { MenuOption } from "@/components/menu-sheet";
import type { SegmentedOption } from "@/components/segmented-pills";

import {
  ISSUE_ASSIGNEE_ICONS,
  ISSUE_ASSIGNEE_LABELS,
  ISSUE_FILTER_LABELS,
  ISSUE_PRIORITY_ICONS,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUS_ICONS,
  ISSUE_STATUS_LABELS,
} from "./content";
import { ISSUE_ASSIGNEE_CHOICES, ISSUE_FILTERS, type IssueAssigneeChoice, type IssueFilterId } from "./issues";

export const STATUS_OPTIONS: MenuOption[] = ISSUE_STATUSES.map((status) => ({
  id: status,
  label: ISSUE_STATUS_LABELS[status],
  icon: ISSUE_STATUS_ICONS[status],
}));

export const PRIORITY_OPTIONS: MenuOption[] = ISSUE_PRIORITIES.map((priority) => ({
  id: priority,
  label: ISSUE_PRIORITY_LABELS[priority],
  icon: ISSUE_PRIORITY_ICONS[priority],
}));

export const ASSIGNEE_OPTIONS: MenuOption[] = ISSUE_ASSIGNEE_CHOICES.map((choice) => ({
  id: choice,
  label: ISSUE_ASSIGNEE_LABELS[choice],
  icon: choice === "claude" ? undefined : ISSUE_ASSIGNEE_ICONS[choice],
}));

export const FILTER_SEGMENTS: SegmentedOption<IssueFilterId>[] = ISSUE_FILTERS.map((filter) => ({
  value: filter,
  label: ISSUE_FILTER_LABELS[filter],
}));

export const STATUS_SEGMENTS: SegmentedOption<IssueStatus>[] = ISSUE_STATUSES.map((status) => ({
  value: status,
  label: ISSUE_STATUS_LABELS[status],
}));

export const PRIORITY_SEGMENTS: SegmentedOption<IssuePriority>[] = ISSUE_PRIORITIES.map((priority) => ({
  value: priority,
  label: ISSUE_PRIORITY_LABELS[priority],
}));

export const HUMAN_ASSIGNEE_SEGMENTS: SegmentedOption<Exclude<IssueAssigneeChoice, "claude">>[] = (
  ["me", "unassigned"] as const
).map((choice) => ({ value: choice, label: ISSUE_ASSIGNEE_LABELS[choice] }));
