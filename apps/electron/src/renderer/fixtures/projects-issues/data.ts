import type { CreateIssue, CreateIssueComment, Issue, IssueComment, IssueDetail, UpdateIssue } from "@tesseract/protocol";
import { BASE_IDS, REFERENCE_IDS } from "../projects/data";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ago = (ms: number, now: number) => new Date(now - ms).toISOString();

export const ISSUE_PROJECTS: readonly string[] = [BASE_IDS.tesseract, REFERENCE_IDS.tesseract];
export const RUNNING_ISSUE_RUN = "run_issuefixture1";

export function fixtureIssue(projectId: string, number: number, patch: Partial<Issue> = {}, now = Date.now()): Issue {
  return {
    id: `iss_${projectId.replace(/[^a-z0-9]/g, "")}${number}`,
    projectId,
    number,
    title: `Issue ${number}`,
    description: "",
    status: "backlog",
    priority: "none",
    assignee: null,
    labels: [],
    sortOrder: number * 1024,
    agentRunId: null,
    agentState: null,
    sessionId: null,
    createdAt: ago((20 - number) * HOUR, now),
    updatedAt: ago((20 - number) * MINUTE, now),
    completedAt: null,
    ...patch,
  };
}

export function fixtureIssues(projectId: string, now = Date.now()): Issue[] {
  const issue = (number: number, patch: Partial<Issue>) => fixtureIssue(projectId, number, patch, now);
  return [
    issue(1, { title: "Set up the release pipeline for the Linux AppImage", status: "done", priority: "medium", assignee: "me", labels: ["release"], completedAt: ago(3 * HOUR, now) }),
    issue(2, { title: "Crash when the sandbox reconnects during a build", status: "in_review", priority: "urgent", assignee: "claude", labels: ["bug"], agentRunId: "run_issuefixture0", agentState: "succeeded", sessionId: "4b3f9e1c-2a7d-4c55-9f1e-8d2b6a0c7e31" }),
    issue(3, {
      title: "Add dark mode to the onboarding screens",
      description: "The onboarding steps still use the light palette.\n\n- Follow the `graphite` tokens\n- Keep contrast at AA",
      status: "in_progress",
      priority: "high",
      assignee: "claude",
      labels: ["ui", "onboarding"],
      agentRunId: RUNNING_ISSUE_RUN,
      agentState: "running",
    }),
    issue(4, { title: "Show build progress in the tray menu", status: "todo", priority: "medium", assignee: "me", labels: ["ui"] }),
    issue(5, { title: "Retry Taildrop sends after a timeout", status: "todo", priority: "low", assignee: "claude", agentRunId: "run_issuefixture2", agentState: "failed" }),
    issue(6, { title: "Document the controller event stream", status: "backlog", priority: "none", labels: ["docs"] }),
    issue(7, { title: "Explore syncing settings across machines", status: "backlog", priority: "low", assignee: "claude" }),
    issue(8, { title: "Drop the legacy GTK screenshots", status: "canceled", completedAt: ago(26 * HOUR, now) }),
  ];
}

export function fixtureIssueComments(issue: Issue, now = Date.now()): IssueComment[] {
  const comment = (index: number, author: IssueComment["author"], body: string, agentRunId: string | null = null): IssueComment => ({
    id: `isc_${issue.id.slice(4)}${index}`,
    issueId: issue.id,
    author,
    body,
    agentRunId,
    createdAt: ago((10 - index) * MINUTE, now),
  });
  if (issue.assignee !== "claude" || !issue.agentRunId) return [comment(1, "me", "Let's get to this after the release.")];
  return [
    comment(1, "system", `Claude started working (${issue.agentRunId})`, issue.agentRunId),
    comment(2, "me", "Keep the change small, please."),
    ...(issue.agentState === "succeeded"
      ? [comment(3, "claude", "Fixed the reconnect race in `useConnection`.\n\n- Added a guard for stale sockets\n- Covered it with a test", issue.agentRunId)]
      : []),
  ];
}

interface IssuesWorld {
  issues: Issue[];
  comments: Map<string, IssueComment[]>;
  numbers: Map<string, number>;
}

let world: IssuesWorld | null = null;

function seed(now = Date.now()): IssuesWorld {
  const issues = ISSUE_PROJECTS.flatMap((projectId) => fixtureIssues(projectId, now));
  return {
    issues,
    comments: new Map(issues.map((issue) => [issue.id, fixtureIssueComments(issue, now)])),
    numbers: new Map(ISSUE_PROJECTS.map((projectId) => [projectId, issues.filter((issue) => issue.projectId === projectId).length])),
  };
}

export function issuesWorld(): IssuesWorld {
  world ??= seed();
  return world;
}

export function resetIssuesWorld(): void {
  world = null;
}

const CLOSED: readonly string[] = ["done", "canceled"];

export function listIssues(query: URLSearchParams): Issue[] {
  const { issues } = issuesWorld();
  const projectId = query.get("projectId");
  const status = query.get("status");
  const assignee = query.get("assignee");
  return issues.filter(
    (issue) => (!projectId || issue.projectId === projectId) && (!status || issue.status === status) && (!assignee || issue.assignee === assignee),
  );
}

export function findIssue(id: string): Issue | null {
  return issuesWorld().issues.find((issue) => issue.id === id) ?? null;
}

export function issueDetail(issue: Issue): IssueDetail {
  return { ...issue, comments: issuesWorld().comments.get(issue.id) ?? [] };
}

export function createIssue(projectId: string, body: CreateIssue, now = Date.now()): Issue {
  const state = issuesWorld();
  const number = (state.numbers.get(projectId) ?? 0) + 1;
  state.numbers.set(projectId, number);
  const status = body.status ?? (body.assignee === "claude" ? "todo" : "backlog");
  const top = Math.min(0, ...state.issues.filter((issue) => issue.projectId === projectId && issue.status === status).map((issue) => issue.sortOrder));
  const issue = fixtureIssue(
    projectId,
    number,
    {
      title: body.title,
      description: body.description ?? "",
      status,
      priority: body.priority ?? "none",
      assignee: body.assignee ?? null,
      labels: body.labels ?? [],
      sortOrder: top - 1024,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    },
    now,
  );
  state.issues.push(issue);
  state.comments.set(issue.id, []);
  return issue;
}

export function updateIssue(issue: Issue, body: UpdateIssue, now = Date.now()): Issue {
  const next: Issue = { ...issue, ...body, labels: body.labels ?? issue.labels, updatedAt: new Date(now).toISOString() };
  if (body.status && body.status !== issue.status) next.completedAt = CLOSED.includes(body.status) ? new Date(now).toISOString() : null;
  const state = issuesWorld();
  state.issues = state.issues.map((candidate) => (candidate.id === issue.id ? next : candidate));
  return next;
}

export function deleteIssue(issue: Issue): Issue {
  const state = issuesWorld();
  state.issues = state.issues.filter((candidate) => candidate.id !== issue.id);
  state.comments.delete(issue.id);
  return issue;
}

export function commentOnIssue(issue: Issue, body: CreateIssueComment, now = Date.now()): IssueComment {
  const state = issuesWorld();
  const list = state.comments.get(issue.id) ?? [];
  const comment: IssueComment = {
    id: `isc_fixture${now.toString(36)}${list.length}`,
    issueId: issue.id,
    author: body.author ?? "me",
    body: body.body.trim(),
    agentRunId: null,
    createdAt: new Date(now).toISOString(),
  };
  state.comments.set(issue.id, [...list, comment]);
  return comment;
}

export function dispatchIssue(issue: Issue): Issue | null {
  if (issue.agentState === "running" || CLOSED.includes(issue.status)) return null;
  return updateIssue(issue, { assignee: "claude", status: "in_progress" });
}

export function startRun(issue: Issue): Issue {
  const next: Issue = { ...issue, agentRunId: RUNNING_ISSUE_RUN, agentState: "running" };
  const state = issuesWorld();
  state.issues = state.issues.map((candidate) => (candidate.id === issue.id ? next : candidate));
  return next;
}
