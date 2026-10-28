import {
  ISSUE_CLOSED_STATUSES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type Issue,
  type IssueAssignee,
  type IssuePriority,
  type IssueStatus,
} from "@tesseract/protocol";

export const ISSUE_FILTERS = ["all", "claude", "mine"] as const;
export type IssueFilterId = (typeof ISSUE_FILTERS)[number];

export const ISSUE_ASSIGNEE_CHOICES = ["me", "claude", "unassigned"] as const;
export type IssueAssigneeChoice = (typeof ISSUE_ASSIGNEE_CHOICES)[number];

export type IssueGroup = { status: IssueStatus; issues: Issue[] };

type IssueRef = Pick<Issue, "projectId" | "number">;

export const issueIdentifier = ({ projectId, number }: IssueRef): string => `${projectId.toUpperCase()}-${number}`;

export const isClosedStatus = (status: IssueStatus): boolean =>
  (ISSUE_CLOSED_STATUSES as readonly IssueStatus[]).includes(status);

export const isIssueRunning = (issue: Pick<Issue, "agentState">): boolean => issue.agentState === "running";

export const countOpenIssues = (issues: readonly Issue[]): number =>
  issues.reduce((total, issue) => (isClosedStatus(issue.status) ? total : total + 1), 0);

export function filterIssues(issues: readonly Issue[], filter: IssueFilterId): Issue[] {
  if (filter === "claude") return issues.filter((issue) => issue.assignee === "claude");
  if (filter === "mine") return issues.filter((issue) => issue.assignee === "me");
  return issues.slice();
}

export function compareIssues(a: Issue, b: Issue): number {
  return (
    ISSUE_STATUSES.indexOf(a.status) - ISSUE_STATUSES.indexOf(b.status) ||
    a.sortOrder - b.sortOrder ||
    b.number - a.number
  );
}

export function groupIssues(issues: readonly Issue[]): IssueGroup[] {
  const sorted = [...issues].sort(compareIssues);
  return ISSUE_STATUSES.map((status) => ({ status, issues: sorted.filter((issue) => issue.status === status) })).filter(
    (group) => group.issues.length > 0,
  );
}

export const initialCollapsed = (): Record<IssueStatus, boolean> =>
  Object.fromEntries(ISSUE_STATUSES.map((status) => [status, isClosedStatus(status)])) as Record<IssueStatus, boolean>;

export const assigneeChoice = (assignee: IssueAssignee | null): IssueAssigneeChoice => assignee ?? "unassigned";

export const assigneeFromChoice = (choice: IssueAssigneeChoice): IssueAssignee | null =>
  choice === "unassigned" ? null : choice;

export const isAssigneeChoice = (value: string): value is IssueAssigneeChoice =>
  (ISSUE_ASSIGNEE_CHOICES as readonly string[]).includes(value);

export const isIssueStatus = (value: string): value is IssueStatus => (ISSUE_STATUSES as readonly string[]).includes(value);

export const isIssuePriority = (value: string): value is IssuePriority =>
  (ISSUE_PRIORITIES as readonly string[]).includes(value);

export const defaultStatusFor = (assignee: IssueAssignee | null): IssueStatus => (assignee === "claude" ? "todo" : "backlog");

/** Mirrors the controller: Claude starts on an open, non-backlog issue assigned to it. */
export const claudeWillStart = (assignee: IssueAssignee | null, status: IssueStatus): boolean =>
  assignee === "claude" && status !== "backlog" && !isClosedStatus(status);

export const canDispatch = (issue: Pick<Issue, "status" | "agentState">): boolean =>
  !isIssueRunning(issue) && !isClosedStatus(issue.status);

export function parseLabels(text: string): string[] {
  return [...new Set(text.split(",").map((label) => label.trim()).filter((label) => label.length > 0))];
}

export const formatLabels = (labels: readonly string[]): string => labels.join(", ");

export const sameLabels = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((label, index) => label === b[index]);
