import {
  ISSUE_CLOSED_STATUSES,
  ISSUE_STATUSES,
  LIMITS,
  type CreateIssue,
  type Issue,
  type IssueAssignee,
  type IssueComment,
  type IssueDetail,
  type IssueStatus,
  type UpdateIssue,
} from "@tesseract/protocol";
import { SORT_STEP } from "./constants";
import type { AgentIndicator, AssigneeChoice, ClaudeHint, DropPosition, IssueColumn, IssueDraft, IssueScope } from "./types";

export type IssuesView = "loading" | "error" | "empty" | "content";

export function issueIdentifier(issue: Pick<Issue, "projectId" | "number">): string {
  return `${issue.projectId.toUpperCase()}-${issue.number}`;
}

export function isClosed(status: IssueStatus): boolean {
  return (ISSUE_CLOSED_STATUSES as readonly IssueStatus[]).includes(status);
}

const statusIndex = (status: IssueStatus) => ISSUE_STATUSES.indexOf(status);

export function compareIssues(a: Issue, b: Issue): number {
  return statusIndex(a.status) - statusIndex(b.status) || a.sortOrder - b.sortOrder || b.number - a.number;
}

export function sortIssues<T extends Issue>(issues: readonly T[]): T[] {
  return [...issues].sort(compareIssues);
}

export function filterIssues<T extends Issue>(issues: readonly T[], scope: IssueScope): T[] {
  if (scope === "all") return [...issues];
  const assignee: IssueAssignee = scope === "claude" ? "claude" : "me";
  return issues.filter((issue) => issue.assignee === assignee);
}

export function issueColumns<T extends Issue>(issues: readonly T[]): IssueColumn<T>[] {
  const sorted = sortIssues(issues);
  return ISSUE_STATUSES.map((status) => ({ status, issues: sorted.filter((issue) => issue.status === status) }));
}

export function issuesView(issues: readonly Issue[] | null, error: unknown): IssuesView {
  if (issues === null) return error ? "error" : "loading";
  return issues.length === 0 ? "empty" : "content";
}

export function upsertIssue(issues: readonly Issue[], issue: Issue): Issue[] {
  const index = issues.findIndex((candidate) => candidate.id === issue.id);
  if (index === -1) return sortIssues([...issues, issue]);
  const next = [...issues];
  next[index] = issue;
  return sortIssues(next);
}

export function removeIssue(issues: readonly Issue[], id: string): Issue[] {
  return issues.filter((issue) => issue.id !== id);
}

export function applyIssuePatch<T extends Issue>(issue: T, patch: UpdateIssue): T {
  const next = { ...issue, ...patch, labels: patch.labels ? normalizeLabels(patch.labels) : issue.labels };
  if (patch.status && patch.status !== issue.status) {
    next.completedAt = isClosed(patch.status) ? (issue.completedAt ?? new Date().toISOString()) : null;
  }
  return next;
}

export function patchIssue(issues: readonly Issue[], id: string, patch: UpdateIssue): Issue[] {
  return sortIssues(issues.map((issue) => (issue.id === id ? applyIssuePatch(issue, patch) : issue)));
}

export function mergeDetail(detail: IssueDetail, issue: Issue): IssueDetail {
  return { ...detail, ...issue, comments: detail.comments };
}

export function appendComment(detail: IssueDetail, comment: IssueComment): IssueDetail {
  if (detail.comments.some((existing) => existing.id === comment.id)) return detail;
  return { ...detail, comments: [...detail.comments, comment] };
}

export function sortOrderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return (after as number) - SORT_STEP;
  if (after === null) return before + SORT_STEP;
  return (before + after) / 2;
}

export function dropUpdate(issues: readonly Issue[], id: string, target: DropPosition): UpdateIssue | null {
  const moving = issues.find((issue) => issue.id === id);
  if (!moving || target.beforeId === id) return null;
  const column = sortIssues(issues.filter((issue) => issue.status === target.status && issue.id !== id));
  const index = target.beforeId === null ? column.length : column.findIndex((issue) => issue.id === target.beforeId);
  const at = index === -1 ? column.length : index;
  const sameSpot =
    moving.status === target.status &&
    sortIssues(issues.filter((issue) => issue.status === target.status)).findIndex((issue) => issue.id === id) === at;
  if (sameSpot) return null;
  const sortOrder = sortOrderBetween(column[at - 1]?.sortOrder ?? null, column[at]?.sortOrder ?? null);
  return moving.status === target.status ? { sortOrder } : { status: target.status, sortOrder };
}

export function agentIndicator(issue: Pick<Issue, "agentState">): AgentIndicator {
  if (issue.agentState === "running") return "running";
  return issue.agentState === "failed" ? "failed" : null;
}

export function canDispatch(issue: Pick<Issue, "status" | "agentState">): boolean {
  return !isClosed(issue.status) && issue.agentState !== "running";
}

export function commentFollowsUp(issue: Pick<Issue, "assignee" | "status">): boolean {
  return issue.assignee === "claude" && !isClosed(issue.status);
}

export function draftStatus(draft: Pick<IssueDraft, "status" | "assignee">): IssueStatus {
  return draft.status ?? (draft.assignee === "claude" ? "todo" : "backlog");
}

export function claudeHint(status: IssueStatus, assignee: AssigneeChoice | IssueAssignee | null): ClaudeHint {
  if (assignee !== "claude" || isClosed(status)) return null;
  return status === "backlog" ? "waits" : "starts";
}

export function toAssignee(choice: AssigneeChoice): IssueAssignee | null {
  return choice === "none" ? null : choice;
}

export function toChoice(assignee: IssueAssignee | null): AssigneeChoice {
  return assignee ?? "none";
}

export function normalizeLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of labels) {
    const label = raw.trim().slice(0, LIMITS.maxIssueLabelLength);
    if (label) seen.add(label);
  }
  return [...seen].slice(0, LIMITS.maxIssueLabels);
}

export function addLabels(labels: readonly string[], input: string): string[] {
  return normalizeLabels([...labels, ...input.split(",")]);
}

export function removeLabel(labels: readonly string[], label: string): string[] {
  return labels.filter((existing) => existing !== label);
}

export function draftTitle(draft: Pick<IssueDraft, "title">): string {
  return draft.title.trim().slice(0, LIMITS.maxIssueTitleLength);
}

export function canCreate(draft: Pick<IssueDraft, "title">): boolean {
  return draftTitle(draft).length > 0;
}

export function draftBody(draft: IssueDraft): CreateIssue {
  const description = draft.description.trim();
  return {
    title: draftTitle(draft),
    ...(description ? { description } : {}),
    ...(draft.status ? { status: draft.status } : {}),
    priority: draft.priority,
    assignee: toAssignee(draft.assignee),
    ...(draft.labels.length > 0 ? { labels: normalizeLabels(draft.labels) } : {}),
  };
}

export function titleUpdate(issue: Pick<Issue, "title">, value: string): UpdateIssue | null {
  const title = value.trim().slice(0, LIMITS.maxIssueTitleLength);
  return title && title !== issue.title ? { title } : null;
}

export function descriptionUpdate(issue: Pick<Issue, "description">, value: string): UpdateIssue | null {
  const description = value.slice(0, LIMITS.maxIssueDescriptionLength);
  return description.trim() === issue.description.trim() ? null : { description };
}

export function knownLabels(issues: readonly Issue[]): string[] {
  return [...new Set(issues.flatMap((issue) => issue.labels))].sort((a, b) => a.localeCompare(b));
}
