import type { IssueCommentAuthor, IssuePriority, IssueStatus } from "@tesseract/protocol";
import {
  CellSignalHighIcon,
  CellSignalLowIcon,
  CellSignalMediumIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  CircleHalfIcon,
  CircleHalfTiltIcon,
  CircleIcon,
  InfoIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
  WarningIcon,
  XCircleIcon,
  type Icon,
} from "phosphor-react-native";

import type { HeaderAction } from "@/components/screen-header";
import type { Tone } from "@/lib/tone";

import type { IssueAssigneeChoice, IssueFilterId } from "./issues";

type ActionTemplate = Omit<HeaderAction, "onPress">;

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  canceled: "Canceled",
};

export const ISSUE_STATUS_ICONS: Record<IssueStatus, Icon> = {
  backlog: CircleDashedIcon,
  todo: CircleIcon,
  in_progress: CircleHalfIcon,
  in_review: CircleHalfTiltIcon,
  done: CheckCircleIcon,
  canceled: XCircleIcon,
};

export const ISSUE_STATUS_TONES: Record<IssueStatus, Tone> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "warning",
  in_review: "info",
  done: "success",
  canceled: "neutral",
};

export const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string> = {
  none: "No priority",
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const ISSUE_PRIORITY_ICONS: Record<IssuePriority, Icon> = {
  none: MinusIcon,
  urgent: WarningIcon,
  high: CellSignalHighIcon,
  medium: CellSignalMediumIcon,
  low: CellSignalLowIcon,
};

export const ISSUE_PRIORITY_TONES: Record<IssuePriority, Tone> = {
  none: "neutral",
  urgent: "danger",
  high: "neutral",
  medium: "neutral",
  low: "neutral",
};

export const ISSUE_ASSIGNEE_LABELS: Record<IssueAssigneeChoice, string> = {
  me: "Me",
  claude: "Claude",
  unassigned: "Unassigned",
};

export const ISSUE_ASSIGNEE_ICONS: Record<Exclude<IssueAssigneeChoice, "claude">, Icon> = {
  me: UserCircleIcon,
  unassigned: CircleDashedIcon,
};

export const ISSUE_AUTHOR_LABELS: Record<IssueCommentAuthor, string> = {
  me: "You",
  claude: "Claude",
  system: "Tesseract",
};

export const ISSUE_AUTHOR_ICONS: Record<Exclude<IssueCommentAuthor, "claude">, Icon> = {
  me: UserCircleIcon,
  system: InfoIcon,
};

export const ISSUE_FILTER_LABELS: Record<IssueFilterId, string> = {
  all: "All",
  claude: "Claude",
  mine: "Mine",
};

export const ISSUE_ACTIONS = {
  create: { id: "create-issue", icon: PlusIcon, label: "New issue" },
  delete: { id: "delete-issue", icon: TrashIcon, label: "Delete issue", tone: "danger" },
} satisfies Record<string, ActionTemplate>;

export const ISSUES_COPY = {
  entry: "Issues",
  entryDetail: (open: number): string | undefined => (open === 0 ? "Plan work for you and Claude" : undefined),
  title: "Issues",
  loading: "Loading issues…",
  failedTitle: "Couldn't load issues",
  retry: "Try again",
  emptyTitle: "No issues yet",
  emptyMessage: "Write down what needs doing. Assign it to Claude and it starts working right away.",
  emptyFiltered: "Nothing matches this filter.",
  newIssue: "New issue",
  filterLabel: "Filter issues",
  statusSheet: "Change status",
  collapse: (label: string) => `Collapse ${label}`,
  expand: (label: string) => `Expand ${label}`,
  running: "Claude is working",
  rowHint: "Long press to change the status",
} as const;

export const ISSUE_FORM_COPY = {
  title: "New issue",
  titleLabel: "Title",
  titlePlaceholder: "What needs doing?",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Add details, steps or acceptance criteria (Markdown)",
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
  assignClaude: "Assign to Claude",
  claudeStarts: "Claude starts working as soon as the issue is created.",
  claudeWaits: "Claude waits while the issue is in Backlog. Move it to Todo to start.",
  claudeOff: "Claude works on the issue in this project and reports back in the activity.",
  create: "Create issue",
  titleRequired: "Give the issue a title.",
} as const;

export const ISSUE_DETAIL_COPY = {
  title: "Issue",
  loading: "Loading issue…",
  failedTitle: "Couldn't load this issue",
  missingTitle: "Issue not found",
  missingMessage: "It may have been deleted.",
  retry: "Try again",
  titleLabel: "Title",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Add a description…",
  properties: "Properties",
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
  labels: "Labels",
  noLabels: "None",
  claude: "Claude",
  runNow: "Run Claude now",
  rerun: "Run Claude again",
  running: "Claude is working on this issue",
  closedHint: "Reopen the issue to run Claude on it.",
  backlogHint: "Claude waits while the issue is in Backlog.",
  viewRun: "View run",
  activity: "Activity",
  noActivity: "No activity yet.",
  commentPlaceholder: "Leave a comment…",
  claudeCommentPlaceholder: "Comment… Claude gets it as a follow-up",
  send: "Send comment",
  labelsSheet: "Labels",
  labelsField: "Labels",
  labelsHint: "Separate labels with commas.",
  save: "Save",
  saveTitle: "Save title",
  saveDescription: "Save description",
  edit: "Edit",
  cancel: "Cancel",
} as const;

export const DELETE_ISSUE_CONFIRM = {
  title: "Delete this issue?",
  message: "Its activity is deleted too, and a running Claude run on it is stopped. This can't be undone.",
  confirmLabel: "Delete",
  cancelLabel: "Keep",
  destructive: true,
} as const;
