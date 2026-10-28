import type { IssueCommentAuthor, IssuePriority, IssueStatus } from "@tesseract/protocol";
import type { AssigneeChoice, IssueLayout, IssueScope } from "./types";

export const ISSUES_LABELS = {
  title: "Issues",
  newIssue: "New issue",
  newIssueIn: (status: string) => `New issue in ${status}`,
  loading: "Loading issues",
  loadFailed: "Couldn't load issues",
  tryAgain: "Try again",
  emptyTitle: "No issues yet",
  emptyMessage: "Track work for this project here. Assign an issue to Claude and it starts on its own.",
  noMatches: "No issues match this filter.",
  emptyColumn: "No issues",
  board: "Issue board",
  list: "Issues by status",
  layout: "Layout",
  scope: "Show",
  toolbar: "Issue options",
} as const;

export const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  canceled: "Canceled",
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  none: "No priority",
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const ASSIGNEE_LABELS: Record<AssigneeChoice, string> = {
  me: "Me",
  claude: "Claude",
  none: "Unassigned",
};

export const AUTHOR_LABELS: Record<IssueCommentAuthor, string> = {
  me: "You",
  claude: "Claude",
  system: "Tesseract",
};

export const SCOPE_LABELS: Record<IssueScope, string> = { all: "All", claude: "Claude", mine: "Mine" };
export const LAYOUT_LABELS: Record<IssueLayout, string> = { board: "Board", list: "List" };

export const AGENT_LABELS = {
  running: "Claude is working",
  failed: "Claude's last run failed",
} as const;

export const CREATE_LABELS = {
  title: "New issue",
  titlePlaceholder: "Issue title",
  titleField: "Title",
  descriptionPlaceholder: "Add a description… Markdown works.",
  descriptionField: "Description",
  create: "Create issue",
  cancel: "Cancel",
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
  labels: "Labels",
  assignClaude: "Assign to Claude",
  claudeHints: {
    starts: "Claude starts working as soon as the issue is created.",
    waits: "Claude starts when the issue leaves Backlog.",
  },
  claudeOff: "Claude starts on its own once an issue is assigned to it and is not in Backlog.",
  created: (identifier: string) => `Created ${identifier}`,
} as const;

export const LABEL_EDITOR_LABELS = {
  add: "Add label",
  remove: (label: string) => `Remove ${label}`,
  field: "Labels",
} as const;

export const SHEET_LABELS = {
  close: "Close",
  titleField: "Issue title",
  description: "Description",
  descriptionField: "Issue description",
  descriptionPlaceholder: "Add a description… Markdown works.",
  noDescription: "No description. Click Edit to add one.",
  edit: "Edit",
  save: "Save",
  cancel: "Cancel",
  properties: "Properties",
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
  labels: "Labels",
  claude: "Claude",
  runClaude: "Run Claude now",
  runningClaude: "Claude is working on this issue.",
  failedClaude: "Claude's last run failed.",
  idleClaude: "Start a Claude run on this issue now.",
  closedClaude: "Reopen the issue to run Claude on it.",
  viewRun: "View run",
  delete: "Delete issue",
  deleteHeading: (identifier: string) => `Delete ${identifier}?`,
  deleteBody: "The issue and its activity are removed. A running Claude run is cancelled.",
  deleteConfirm: "Delete",
  activity: "Activity",
  noActivity: "No activity yet.",
  comment: "Comment",
  commentPlaceholder: "Leave a comment…",
  followUpPlaceholder: "Comment… Claude gets it as a follow-up and continues the work.",
  loading: "Loading issue",
} as const;
