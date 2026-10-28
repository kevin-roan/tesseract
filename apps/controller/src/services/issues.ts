import {
  createId,
  ISSUE_CLOSED_STATUSES,
  LIMITS,
  type AgentRun,
  type CreateIssue,
  type CreateIssueComment,
  type DispatchIssue,
  type Issue,
  type IssueComment,
  type IssueCommentAuthor,
  type IssueDetail,
  type IssueQuery,
  type IssueStatus,
  type UpdateIssue,
} from "@tesseract/protocol";
import { conflict, errorMessage, notFound } from "../core/errors";
import { nowIso } from "../core/time";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";
import type { AgentRunService } from "./agent-runs";
import type { ProjectService } from "./projects";

export const ISSUE_ENV = "TESSERACT_ISSUE_ID";
const PROMPT_COMMENTS = 20;
const RESTART_ERROR = "The controller restarted before this finished";

type IssueRunner = Pick<AgentRunService, "start" | "cancel">;
type IssueProjects = Pick<ProjectService, "require">;
type RunOptions = { prompt: string; mode?: DispatchIssue["mode"]; model?: DispatchIssue["model"]; resumeSessionId?: string };

export const isClosed = (status: IssueStatus) => (ISSUE_CLOSED_STATUSES as readonly IssueStatus[]).includes(status);
export const issueIdentifier = (issue: Pick<Issue, "projectId" | "number">) => `${issue.projectId.toUpperCase()}-${issue.number}`;

const wantsClaude = (issue: Issue) => issue.assignee === "claude" && issue.status !== "backlog" && !isClosed(issue.status);
const isRunning = (issue: Issue) => issue.agentState === "running" && issue.agentRunId !== null;

export function issuePrompt(issue: Issue, comments: readonly IssueComment[], note?: string): string {
  const facts = [`Priority: ${issue.priority}`, ...(issue.labels.length > 0 ? [`Labels: ${issue.labels.join(", ")}`] : [])];
  const activity = comments
    .filter((comment) => comment.author !== "system")
    .slice(-PROMPT_COMMENTS)
    .map((comment) => `${comment.author === "me" ? "User" : "Claude"} (${comment.createdAt}):\n${comment.body}`);
  return [
    `Work on issue ${issueIdentifier(issue)} of project ${issue.projectId}: ${issue.title}`,
    facts.join(" · "),
    issue.description.trim() ? `Description:\n${issue.description.trim()}` : "",
    activity.length > 0 ? `Earlier activity:\n\n${activity.join("\n\n")}` : "",
    note ? `Additional instructions:\n${note}` : "",
    [
      "Work in this project and keep the changes focused on this issue.",
      `You can post progress with \`tesseract-controller issue comment "<text>"\` and split off follow-up work with \`tesseract-controller issue create --title "<title>"\`.`,
      "When you are done, finish with a short summary of what was done.",
    ].join(" "),
  ]
    .filter((part) => part !== "")
    .join("\n\n");
}

/** Project issues, Linear style; an issue assigned to Claude is worked on as an agent run in its project (docs/architecture/issues.md). */
export class IssueService {
  constructor(
    private readonly repos: Repositories,
    private readonly hub: EventHub,
    private readonly projects: IssueProjects,
    private readonly agentRuns: IssueRunner,
    private readonly logger: Logger,
  ) {}

  list(query: IssueQuery = {}): Issue[] {
    return this.repos.issueList(query, LIMITS.maxIssueList);
  }

  get(id: string): IssueDetail {
    const issue = this.require(id);
    return { ...issue, comments: this.repos.issueCommentList(id, LIMITS.maxIssueComments) };
  }

  create(projectId: string, input: CreateIssue): Issue {
    const project = this.projects.require(projectId).id;
    const assignee = input.assignee ?? null;
    const status = input.status ?? (assignee === "claude" ? "todo" : "backlog");
    const now = nowIso();
    const issue: Issue = {
      id: createId("issue"),
      projectId: project,
      number: this.repos.nextIssueNumber(project),
      title: input.title,
      description: input.description ?? "",
      status,
      priority: input.priority ?? "none",
      assignee,
      labels: input.labels ?? [],
      sortOrder: this.topOf(project, status),
      agentRunId: null,
      agentState: null,
      sessionId: null,
      createdAt: now,
      updatedAt: now,
      completedAt: isClosed(status) ? now : null,
    };
    this.save(issue);
    return wantsClaude(issue) ? this.tryStart(issue, { prompt: issuePrompt(issue, []) }) : issue;
  }

  update(id: string, input: UpdateIssue): Issue {
    const before = this.require(id);
    let next: Issue = {
      ...before,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.assignee !== undefined ? { assignee: input.assignee } : {}),
      ...(input.labels !== undefined ? { labels: input.labels } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    };
    if (input.status !== undefined && input.status !== before.status) {
      next = this.moved(next, input.status, input.sortOrder);
    }
    next.updatedAt = nowIso();
    this.save(next);
    if (isRunning(before) && (next.assignee !== "claude" || isClosed(next.status))) {
      this.cancelRun(before.agentRunId!);
    } else if (!isRunning(before) && wantsClaude(next) && !wantsClaude(before)) {
      return this.tryStart(next, { prompt: issuePrompt(next, this.repos.issueCommentList(id, LIMITS.maxIssueComments)) });
    }
    return next;
  }

  delete(id: string): Issue {
    const issue = this.require(id);
    if (isRunning(issue)) this.cancelRun(issue.agentRunId!);
    this.repos.deleteIssue(id);
    this.hub.publish({ type: "issue.deleted", id, projectId: issue.projectId });
    return issue;
  }

  comment(id: string, input: CreateIssueComment): IssueComment {
    const issue = this.require(id);
    const author = input.author ?? "me";
    const comment = this.addComment(issue, author, input.body);
    if (author === "me" && issue.assignee === "claude" && !isClosed(issue.status) && !isRunning(issue) && issue.sessionId !== null) {
      this.tryStart(issue, { prompt: input.body, resumeSessionId: issue.sessionId });
    }
    return comment;
  }

  /** Assigns the issue to Claude and starts a run now (backlog moves to todo first); 409 while one runs or for a closed issue. */
  dispatch(id: string, input: DispatchIssue = {}): Issue {
    const issue = this.require(id);
    if (isClosed(issue.status)) throw conflict(`Issue ${issueIdentifier(issue)} is ${issue.status}; reopen it first`);
    if (isRunning(issue)) throw conflict(`Claude is already working on ${issueIdentifier(issue)} (${issue.agentRunId})`);
    const next: Issue = { ...issue, assignee: "claude", ...(issue.status === "backlog" ? { status: "todo" as const } : {}) };
    const comments = this.repos.issueCommentList(id, LIMITS.maxIssueComments);
    return this.startRun(next, { prompt: issuePrompt(next, comments, input.note), mode: input.mode, model: input.model });
  }

  /** Keeps issues in step with their agent runs, and drops a deleted project's issues. Returns the unsubscribe function. */
  follow(): () => void {
    return this.hub.subscribe((event) => {
      if (event.type === "agent.updated") this.runUpdated(event.run);
      else if (event.type === "project.deleted") this.projectDeleted(event.id);
    });
  }

  /** After a restart: issues whose run is no longer running get the outcome stored in `agent_runs`. */
  reconcile(): number {
    const stale = this.repos.issues.where("agent_state = 'running'");
    for (const issue of stale) {
      const run = issue.agentRunId === null ? null : this.repos.agentRuns.get(issue.agentRunId);
      if (run?.state === "running") continue;
      this.runEnded(issue, run ?? { state: "failed", sessionId: null, result: null, error: RESTART_ERROR, id: issue.agentRunId });
    }
    if (stale.length > 0) this.logger.info("reconciled issues with their agent runs", { count: stale.length });
    return stale.length;
  }

  private runUpdated(run: AgentRun): void {
    const issue = this.repos.issueForAgentRun(run.id);
    if (!issue || issue.agentRunId !== run.id) return;
    if (run.state !== "running") {
      if (issue.agentState === "running") this.runEnded(issue, run);
      return;
    }
    if (issue.agentState === run.state && (run.sessionId === null || issue.sessionId === run.sessionId)) return;
    this.save({ ...issue, agentState: run.state, sessionId: run.sessionId ?? issue.sessionId, updatedAt: nowIso() });
  }

  private runEnded(issue: Issue, run: Pick<AgentRun, "state" | "sessionId" | "result" | "error"> & { id: string | null }): void {
    let next: Issue = { ...issue, agentState: run.state, sessionId: run.sessionId ?? issue.sessionId, updatedAt: nowIso() };
    const inProgress = issue.status === "in_progress";
    if (run.state === "succeeded") {
      if (inProgress) next = this.moved(next, "in_review");
      this.save(next);
      this.addComment(next, "claude", run.result?.trim() || "Finished.", run.id);
      return;
    }
    if (inProgress) next = this.moved(next, "todo");
    this.save(next);
    const text = run.state === "cancelled" ? "Claude's run was cancelled" : `Claude's run failed: ${run.error ?? "unknown error"}`;
    this.addComment(next, "system", text, run.id);
  }

  private projectDeleted(projectId: string): void {
    for (const issue of this.repos.deleteProjectIssues(projectId)) {
      if (isRunning(issue)) this.cancelRun(issue.agentRunId!);
      this.hub.publish({ type: "issue.deleted", id: issue.id, projectId });
    }
  }

  /** Automatic starts never fail the request: a run that cannot start leaves a system comment. */
  private tryStart(issue: Issue, options: RunOptions): Issue {
    try {
      return this.startRun(issue, options);
    } catch (error) {
      this.logger.warn("could not start Claude on an issue", { issue: issue.id, error });
      this.addComment(issue, "system", `Could not start Claude: ${errorMessage(error)}`);
      return issue;
    }
  }

  private startRun(issue: Issue, options: RunOptions): Issue {
    const run = this.agentRuns.start(
      {
        projectId: issue.projectId,
        prompt: options.prompt,
        ...(options.mode ? { mode: options.mode } : {}),
        ...(options.model ? { model: options.model } : {}),
        ...(options.resumeSessionId ? { resumeSessionId: options.resumeSessionId } : {}),
      },
      { env: { [ISSUE_ENV]: issue.id } },
    );
    const moved = issue.status === "in_progress" ? issue : this.moved(issue, "in_progress");
    const next: Issue = { ...moved, agentRunId: run.id, agentState: run.state, sessionId: run.sessionId ?? issue.sessionId, updatedAt: nowIso() };
    this.save(next);
    this.addComment(next, "system", `Claude started working (${run.id})`, run.id);
    return next;
  }

  private cancelRun(runId: string): void {
    this.agentRuns.cancel(runId).catch((error: unknown) => this.logger.warn("could not cancel an issue's agent run", { run: runId, error }));
  }

  /** Moves to `status` at the top of its column unless `sortOrder` is given; entering or leaving done/canceled sets or clears `completedAt`. */
  private moved(issue: Issue, status: IssueStatus, sortOrder?: number): Issue {
    const closed = isClosed(status);
    return {
      ...issue,
      status,
      sortOrder: sortOrder ?? this.topOf(issue.projectId, status),
      completedAt: closed ? (isClosed(issue.status) ? issue.completedAt : nowIso()) : null,
    };
  }

  private topOf(projectId: string, status: IssueStatus): number {
    const low = this.repos.minIssueSortOrder(projectId, status);
    return low === null ? 0 : low - 1;
  }

  private addComment(issue: Issue, author: IssueCommentAuthor, body: string, agentRunId: string | null = null): IssueComment {
    const comment: IssueComment = { id: createId("issueComment"), issueId: issue.id, author, body, agentRunId, createdAt: nowIso() };
    this.repos.issueComments.save(comment);
    this.hub.publish({ type: "issue.commented", comment: { ...comment }, projectId: issue.projectId });
    return comment;
  }

  private save(issue: Issue): void {
    this.repos.issues.save(issue);
    this.hub.publish({ type: "issue.updated", issue: { ...issue } });
  }

  private require(id: string): Issue {
    const issue = this.repos.issues.get(id);
    if (!issue) throw notFound(`Issue ${id.slice(0, 80)} not found`);
    return issue;
  }
}
