import { ISSUE_PRIORITIES, ISSUE_STATUSES, type IssuePriority, type IssueStatus } from "@tesseract/protocol";
import type { ChoiceOption } from "../../../../components/ChoiceDropdown";
import type { ChipOption } from "../../../../components/Chip";
import type { SegmentOption } from "../../../../components/SegmentedControl";
import { ASSIGNEE_CHOICES, ISSUE_LAYOUTS, ISSUE_SCOPES, LAYOUT_ICONS, SCOPE_ICONS } from "./constants";
import { ASSIGNEE_LABELS, LAYOUT_LABELS, PRIORITY_LABELS, SCOPE_LABELS, STATUS_LABELS } from "./labels";
import type { AssigneeChoice, IssueLayout, IssueScope } from "./types";

export const STATUS_CHOICES: readonly ChoiceOption<IssueStatus>[] = ISSUE_STATUSES.map((id) => ({ id, label: STATUS_LABELS[id] }));
export const PRIORITY_CHOICES: readonly ChoiceOption<IssuePriority>[] = ISSUE_PRIORITIES.map((id) => ({ id, label: PRIORITY_LABELS[id] }));
export const ASSIGNEE_OPTIONS: readonly ChoiceOption<AssigneeChoice>[] = ASSIGNEE_CHOICES.map((id) => ({ id, label: ASSIGNEE_LABELS[id] }));
export const SCOPE_CHOICES: readonly ChipOption<IssueScope>[] = ISSUE_SCOPES.map((id) => ({ id, label: SCOPE_LABELS[id], icon: SCOPE_ICONS[id] }));
export const LAYOUT_CHOICES: readonly SegmentOption<IssueLayout>[] = ISSUE_LAYOUTS.map((id) => ({ id, label: LAYOUT_LABELS[id], icon: LAYOUT_ICONS[id] }));
