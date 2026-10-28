import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  AgentRunDetailSchema,
  IssueCommentSchema,
  IssueDetailSchema,
  IssueListSchema,
  IssueSchema,
  type AgentRun,
  type AgentRunDetail,
  type Issue,
  type IssueDetail,
  type ServerEvent,
} from "@tesseract/protocol";
import { runCli, type Output } from "../src/cli/commands";
import { issueIdentifier, issuePrompt } from "../src/services/issues";
import { installFixture, makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, waitFor, writeFiles, type TestController, type WsClient } from "./helpers";

let t: TestController;
let events: WsClient;

async function create(projectId: string, body: Record<string, unknown>): Promise<Issue> {
  const { status, body: issue } = await t.json("POST", `/v1/projects/${projectId}/issues`, body);
  if (status !== 201) throw new Error(`create failed: ${status} ${JSON.stringify(issue)}`);
  return IssueSchema.parse(issue);
}

async function patch(id: string, body: Record<string, unknown>): Promise<Issue> {
  const { status, body: issue } = await t.json("PATCH", `/v1/issues/${id}`, body);
  if (status !== 200) throw new Error(`update failed: ${status} ${JSON.stringify(issue)}`);
  return IssueSchema.parse(issue);
}

async function detail(id: string): Promise<IssueDetail> {
  return IssueDetailSchema.parse((await t.json("GET", `/v1/issues/${id}`)).body);
}

async function run(id: string): Promise<AgentRunDetail> {
  return AgentRunDetailSchema.parse((await t.json("GET", `/v1/agent/runs/${id}`)).body);
}

const until = (id: string, check: (issue: IssueDetail) => boolean) =>
  waitFor(async () => {
    const issue = await detail(id);
    return check(issue) ? issue : null;
  }, 10_000);

const texts = (detail: AgentRunDetail) => detail.events.flatMap((event) => (event.kind === "text" ? [event.text] : []));

function capture(): Output & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (text) => stdout.push(text), err: (text) => stderr.push(text) };
}

beforeAll(async () => {
  const workspace = makeTempDir("issues");
  writeFiles(workspace, { "projects/app/.keep": "", "projects/web/.keep": "", "projects/doomed/.keep": "", "projects/cli/.keep": "" });
  const claude = installFixture(makeTempDir("issues-bin"), "fake-claude-issue.sh", "claude");
  t = await startTestController({ workspace, env: { TESSERACT_CLAUDE_BIN: claude } });
  events = await t.socket("/v1/events");
});

afterAll(async () => {
  events.close();
  await t.stop();
  removeTempDirs();
});

describe("issues", () => {
  test("create, read, update and delete with per-project numbers that are never reused", async () => {
    const first = await create("app", { title: "  First  ", description: "Some **markdown**", labels: ["bug", "bug", "ui"] });
    expect(first).toMatchObject({
      projectId: "app",
      number: 1,
      title: "First",
      description: "Some **markdown**",
      status: "backlog",
      priority: "none",
      assignee: null,
      labels: ["bug", "ui"],
      agentRunId: null,
      agentState: null,
      sessionId: null,
      completedAt: null,
    });
    expect(first.id).toStartWith("iss_");
    expect(issueIdentifier(first)).toBe("APP-1");
    const second = await create("app", { title: "Second", priority: "high", assignee: "me" });
    expect(second).toMatchObject({ number: 2, priority: "high", assignee: "me", status: "backlog" });
    expect((await create("web", { title: "Other project" })).number).toBe(1);

    const updated = await patch(first.id, { title: "Renamed", labels: [], priority: "low" });
    expect(updated).toMatchObject({ title: "Renamed", labels: [], priority: "low", number: 1 });
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(first.updatedAt));
    expect(await detail(first.id)).toMatchObject({ title: "Renamed", comments: [] });

    const done = await patch(first.id, { status: "done" });
    expect(done.completedAt).not.toBeNull();
    expect((await patch(first.id, { status: "canceled" })).completedAt).toBe(done.completedAt);
    expect((await patch(first.id, { status: "todo" })).completedAt).toBeNull();

    const deleted = await t.json("DELETE", `/v1/issues/${second.id}`);
    expect(deleted.status).toBe(200);
    expect(IssueSchema.parse(deleted.body).id).toBe(second.id);
    expect((await t.json("GET", `/v1/issues/${second.id}`)).status).toBe(404);
    expect((await create("app", { title: "Third" })).number).toBe(3);
  });

  test("lists in board order, top of the column first, and filters", async () => {
    const a = await create("web", { title: "a", status: "todo" });
    const b = await create("web", { title: "b", status: "todo" });
    const c = await create("web", { title: "c", status: "in_review", assignee: "me" });
    const d = await create("web", { title: "d", status: "backlog" });
    expect(b.sortOrder).toBeLessThan(a.sortOrder);
    const listed = IssueListSchema.parse((await t.json("GET", "/v1/issues?projectId=web")).body);
    const ids = listed.map((issue) => issue.id);
    expect(ids.indexOf(d.id)).toBeLessThan(ids.indexOf(b.id));
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id));
    expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(c.id));
    expect(listed.every((issue) => issue.projectId === "web")).toBe(true);

    await patch(a.id, { sortOrder: b.sortOrder - 10 });
    const todo = IssueListSchema.parse((await t.json("GET", "/v1/issues?projectId=web&status=todo")).body);
    expect(todo.map((issue) => issue.id)).toEqual([a.id, b.id]);
    const mine = IssueListSchema.parse((await t.json("GET", "/v1/issues?projectId=web&assignee=me")).body);
    expect(mine.map((issue) => issue.id)).toEqual([c.id]);
    const moved = await patch(d.id, { status: "in_review" });
    expect(moved.sortOrder).toBeLessThan(c.sortOrder);
  });

  test("rejects invalid input", async () => {
    const issue = await create("app", { title: "Valid" });
    const cases: [string, string, unknown, number][] = [
      ["POST", "/v1/projects/app/issues", { title: "   " }, 400],
      ["POST", "/v1/projects/app/issues", { title: "x", status: "doing" }, 400],
      ["POST", "/v1/projects/app/issues", { title: "x", labels: Array.from({ length: 21 }, (_, i) => `l${i}`) }, 400],
      ["POST", "/v1/projects/nope/issues", { title: "x" }, 404],
      ["PATCH", `/v1/issues/${issue.id}`, {}, 400],
      ["PATCH", `/v1/issues/${issue.id}`, { assignee: "bob" }, 400],
      ["PATCH", "/v1/issues/iss_missing00", { title: "x" }, 404],
      ["GET", "/v1/issues/not-an-id", undefined, 404],
      ["GET", "/v1/issues?status=doing", undefined, 400],
      ["POST", `/v1/issues/${issue.id}/comments`, { body: "" }, 400],
      ["POST", `/v1/issues/${issue.id}/comments`, { body: "hi", author: "system" }, 400],
      ["POST", `/v1/issues/${issue.id}/dispatch`, { mode: "yolo" }, 400],
    ];
    for (const [method, path, body, status] of cases) {
      expect([method, path, (await t.request(method, path, body)).status]).toEqual([method, path, status]);
    }
  });

  test("publishes issue events", async () => {
    const issue = await create("app", { title: "Evented" });
    await events.waitFor<ServerEvent>((event) => event.type === "issue.updated" && event.issue.id === issue.id);
    const { status, body } = await t.json("POST", `/v1/issues/${issue.id}/comments`, { body: "Looks good" });
    expect(status).toBe(201);
    const comment = IssueCommentSchema.parse(body);
    expect(comment).toMatchObject({ issueId: issue.id, author: "me", body: "Looks good", agentRunId: null });
    await events.waitFor<ServerEvent>((event) => event.type === "issue.commented" && event.comment.id === comment.id && event.projectId === "app");
    expect((await detail(issue.id)).comments.map((entry) => entry.id)).toEqual([comment.id]);
    await t.json("DELETE", `/v1/issues/${issue.id}`);
    await events.waitFor<ServerEvent>((event) => event.type === "issue.deleted" && event.id === issue.id && event.projectId === "app");
  });

  test("deleting a project deletes its issues", async () => {
    const first = await create("doomed", { title: "One" });
    await t.json("POST", `/v1/issues/${first.id}/comments`, { body: "note" });
    const second = await create("doomed", { title: "Two" });
    expect((await t.json("DELETE", "/v1/projects/doomed?force=1")).status).toBe(200);
    await events.waitFor<ServerEvent>((event) => event.type === "issue.deleted" && event.id === second.id);
    expect(IssueListSchema.parse((await t.json("GET", "/v1/issues?projectId=doomed")).body)).toEqual([]);
    expect((await t.json("GET", `/v1/issues/${first.id}`)).status).toBe(404);
    expect(t.controller.services.repos.issueComments.where("issue_id = ?", first.id)).toEqual([]);
  });
});

describe("Claude automation", () => {
  test("creating an issue for Claude runs it in the project and moves it to review with Claude's result", async () => {
    const created = await create("app", { title: "Fix the login", description: "It breaks", assignee: "claude", labels: ["auth"] });
    expect(created).toMatchObject({ status: "in_progress", assignee: "claude", agentState: "running" });
    expect(created.agentRunId).toStartWith("run_");
    const done = await until(created.id, (issue) => issue.status === "in_review");
    expect(done).toMatchObject({ agentState: "succeeded", sessionId: "sess-issue-1", agentRunId: created.agentRunId });
    expect(done.comments.map((comment) => [comment.author, comment.body])).toEqual([
      ["system", `Claude started working (${created.agentRunId})`],
      ["claude", "Fixed it"],
    ]);
    expect(done.comments.every((comment) => comment.agentRunId === created.agentRunId)).toBe(true);
    const agentRun = await run(created.agentRunId!);
    expect(agentRun.projectId).toBe("app");
    expect(agentRun.prompt).toContain(`Work on issue APP-${created.number} of project app: Fix the login`);
    expect(agentRun.prompt).toContain("It breaks");
    expect(agentRun.prompt).toContain("Labels: auth");
    expect(texts(agentRun)).toContain(`issue: ${created.id}`);
    expect(texts(agentRun)).toContain(`cwd: ${join(t.workspace, "projects", "app")}`);
  });

  test("an empty result still leaves a Claude comment", async () => {
    const created = await create("app", { title: "Quiet [silent]", assignee: "claude" });
    const done = await until(created.id, (issue) => issue.status === "in_review");
    expect(done.comments.at(-1)).toMatchObject({ author: "claude", body: "Finished." });
  });

  test("backlog waits; moving to todo or assigning to Claude starts work", async () => {
    const waiting = await create("app", { title: "Later", assignee: "claude", status: "backlog" });
    expect(waiting).toMatchObject({ status: "backlog", agentRunId: null });
    await Bun.sleep(100);
    expect((await detail(waiting.id)).comments).toEqual([]);
    const started = await patch(waiting.id, { status: "todo" });
    expect(started).toMatchObject({ status: "in_progress", agentState: "running" });
    await until(waiting.id, (issue) => issue.status === "in_review");

    const mine = await create("app", { title: "Mine", assignee: "me", status: "todo" });
    expect(mine.agentRunId).toBeNull();
    const assigned = await patch(mine.id, { assignee: "claude" });
    expect(assigned).toMatchObject({ status: "in_progress", agentState: "running" });
    await until(mine.id, (issue) => issue.status === "in_review");
  });

  test("a failed run moves the issue back to todo with the error", async () => {
    const created = await create("app", { title: "Broken [fail]", assignee: "claude" });
    const failed = await until(created.id, (issue) => issue.agentState === "failed");
    expect(failed.status).toBe("todo");
    expect(failed.comments.at(-1)).toMatchObject({ author: "system", agentRunId: created.agentRunId });
    expect(failed.comments.at(-1)?.body).toContain("boom: issue failure");
  });

  test("unassigning Claude cancels the run", async () => {
    const created = await create("app", { title: "Long [slow]", assignee: "claude" });
    await until(created.id, (issue) => issue.sessionId !== null);
    const unassigned = await patch(created.id, { assignee: null });
    expect(unassigned.assignee).toBeNull();
    const cancelled = await until(created.id, (issue) => issue.agentState === "cancelled");
    expect(cancelled.status).toBe("todo");
    expect(cancelled.comments.at(-1)).toMatchObject({ author: "system", body: "Claude's run was cancelled" });
    expect((await run(created.agentRunId!)).state).toBe("cancelled");
  });

  test("closing or deleting an issue cancels its run", async () => {
    const closing = await create("app", { title: "Close me [slow]", assignee: "claude" });
    await until(closing.id, (issue) => issue.sessionId !== null);
    await patch(closing.id, { status: "done" });
    const closed = await until(closing.id, (issue) => issue.agentState === "cancelled");
    expect(closed.status).toBe("done");

    const deleting = await create("app", { title: "Delete me [slow]", assignee: "claude" });
    await waitFor(async () => (await run(deleting.agentRunId!)).sessionId);
    expect((await t.json("DELETE", `/v1/issues/${deleting.id}`)).status).toBe(200);
    await waitFor(async () => (await run(deleting.agentRunId!)).state === "cancelled", 10_000);
  });

  test("a comment on a finished Claude issue resumes the session", async () => {
    const created = await create("app", { title: "Iterate", assignee: "claude" });
    const reviewed = await until(created.id, (issue) => issue.status === "in_review");
    const { status } = await t.json("POST", `/v1/issues/${created.id}/comments`, { body: "Please also add tests" });
    expect(status).toBe(201);
    const resumed = await until(created.id, (issue) => issue.agentRunId !== reviewed.agentRunId && issue.status === "in_review");
    const followUp = await run(resumed.agentRunId!);
    expect(followUp).toMatchObject({ prompt: "Please also add tests", resumedSessionId: "sess-issue-1", projectId: "app" });
    expect(texts(followUp).find((text) => text.startsWith("args:"))).toContain("--resume sess-issue-1");
    expect(resumed.comments.map((comment) => comment.author)).toEqual(["system", "claude", "me", "system", "claude"]);

    const claudeComment = await t.json("POST", `/v1/issues/${created.id}/comments`, { body: "Progress note", author: "claude" });
    expect(claudeComment.status).toBe(201);
    await Bun.sleep(100);
    expect((await detail(created.id)).agentRunId).toBe(resumed.agentRunId);
  });

  test("dispatch starts Claude now, refusing running and closed issues", async () => {
    const backlog = await create("app", { title: "Dispatch me [slow]" });
    const { status, body } = await t.json("POST", `/v1/issues/${backlog.id}/dispatch`, { note: "Be quick" });
    expect(status).toBe(200);
    const dispatched = IssueSchema.parse(body);
    expect(dispatched).toMatchObject({ assignee: "claude", status: "in_progress", agentState: "running" });
    expect((await run(dispatched.agentRunId!)).prompt).toContain("Additional instructions:\nBe quick");
    const again = await t.json<{ error: { code: string } }>("POST", `/v1/issues/${backlog.id}/dispatch`);
    expect([again.status, again.body.error.code]).toEqual([409, "conflict"]);
    await t.json("DELETE", `/v1/issues/${backlog.id}`);

    const closed = await create("app", { title: "Closed", status: "done" });
    expect(closed.completedAt).not.toBeNull();
    expect((await t.json("POST", `/v1/issues/${closed.id}/dispatch`)).status).toBe(409);
  });

  test("the prompt carries the issue, prior comments and instructions", () => {
    const issue = IssueSchema.parse({
      id: "iss_abcdefghij",
      projectId: "mobile",
      number: 12,
      title: "Add dark mode",
      description: "Use the system setting",
      status: "todo",
      priority: "urgent",
      assignee: "claude",
      labels: ["ui"],
      sortOrder: 0,
      agentRunId: null,
      agentState: null,
      sessionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    });
    const comment = (author: "me" | "claude" | "system", body: string) => ({ id: "isc_abcdefghij", issueId: issue.id, author, body, agentRunId: null, createdAt: issue.createdAt });
    const prompt = issuePrompt(issue, [comment("me", "Also the settings screen"), comment("system", "Claude started working")]);
    expect(prompt).toStartWith("Work on issue MOBILE-12 of project mobile: Add dark mode");
    expect(prompt).toContain("Priority: urgent · Labels: ui");
    expect(prompt).toContain("Use the system setting");
    expect(prompt).toContain("Also the settings screen");
    expect(prompt).not.toContain("Claude started working");
    expect(prompt).toContain("finish with a short summary");
  });
});

describe("issue CLI", () => {
  const env = () => ({
    TESSERACT_WORKSPACE: t.workspace,
    TESSERACT_HOST: "127.0.0.1",
    TESSERACT_PORT: String(t.controller.url.port),
    TESSERACT_TOKEN: TEST_TOKEN,
    TESSERACT_SANDBOX_ID: "test-sandbox",
  });

  test("create, list, show, update and comment", async () => {
    const created = capture();
    const cwd = join(t.workspace, "projects", "cli");
    expect(await runCli(["issue", "create", "--title", "From the CLI", "--priority", "high", "--label", "a", "--label", "b"], { env: env(), output: created, cwd })).toBe(0);
    expect(created.stdout[0]).toMatch(/^created CLI-1 \(iss_\w+, backlog\): From the CLI$/);
    const id = /\((iss_\w+),/.exec(created.stdout[0] ?? "")?.[1] ?? "";

    const listed = capture();
    expect(await runCli(["issue", "list", "--project", "cli"], { env: env(), output: listed })).toBe(0);
    expect(listed.stdout.join("\n")).toMatch(/CLI-1\s+backlog\s+high\s+-\s+iss_\w+\s+From the CLI/);

    const updated = capture();
    expect(await runCli(["issue", "update", id, "--status", "todo", "--assignee", "me"], { env: env(), output: updated })).toBe(0);
    expect(updated.stdout[0]).toBe("updated CLI-1 (todo, me): From the CLI");

    const commented = capture();
    expect(await runCli(["issue", "comment", "Working", "on", "it"], { env: { ...env(), TESSERACT_ISSUE_ID: id }, output: commented })).toBe(0);
    expect(commented.stdout[0]).toStartWith(`commented on ${id}`);
    const fromStdin = capture();
    expect(await runCli(["issue", "comment", id, "-"], { env: env(), output: fromStdin, readStdin: async () => "line one\nline two" })).toBe(0);

    const shown = capture();
    expect(await runCli(["issue", "show"], { env: { ...env(), TESSERACT_ISSUE_ID: id }, output: shown })).toBe(0);
    const text = shown.stdout.join("\n");
    expect(text).toContain("CLI-1  From the CLI");
    expect(text).toContain("labels     a, b");
    expect(text).toContain("claude · just now\n    Working on it");
    expect(text).toContain("    line two");
    const comments = (await detail(id)).comments;
    expect(comments.map((comment) => comment.author)).toEqual(["claude", "claude"]);

    const split = capture();
    expect(await runCli(["issue", "create", "--title", "Follow-up", "--json"], { env: { ...env(), TESSERACT_ISSUE_ID: id }, output: split, cwd: t.workspace })).toBe(0);
    expect(IssueSchema.parse(JSON.parse(split.stdout.join("\n")))).toMatchObject({ projectId: "cli", number: 2 });
  });

  test("usage errors", async () => {
    const missing = capture();
    expect(await runCli(["issue", "comment", "hello"], { env: env(), output: missing })).toBe(2);
    expect(missing.stderr.join("\n")).toContain("TESSERACT_ISSUE_ID");
    const bad = capture();
    expect(await runCli(["issue", "list", "--status", "doing"], { env: env(), output: bad })).toBe(2);
    const noProject = capture();
    expect(await runCli(["issue", "create", "--title", "x"], { env: env(), output: noProject, cwd: t.workspace })).toBe(2);
    expect(noProject.stderr.join("\n")).toContain("--project");
    const unknown = capture();
    expect(await runCli(["issue", "show", "iss_missing00"], { env: env(), output: unknown })).toBe(1);
  });
});

describe("without Claude", () => {
  let bare: TestController;

  beforeAll(async () => {
    const workspace = makeTempDir("issues-bare");
    writeFiles(workspace, { "projects/app/.keep": "" });
    bare = await startTestController({ workspace });
  });

  afterAll(async () => {
    await bare.stop();
  });

  test("dispatch is 503 and automatic starts leave a system comment", async () => {
    const { status, body } = await bare.json("POST", "/v1/projects/app/issues", { title: "Needs Claude", assignee: "claude" });
    expect(status).toBe(201);
    const issue = IssueSchema.parse(body);
    expect(issue).toMatchObject({ status: "todo", agentRunId: null });
    const comments = IssueDetailSchema.parse((await bare.json("GET", `/v1/issues/${issue.id}`)).body).comments;
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ author: "system" });
    expect(comments[0]?.body).toStartWith("Could not start Claude:");
    expect((await bare.json("POST", `/v1/issues/${issue.id}/dispatch`)).status).toBe(503);
  });

  test("reconcile applies runs that ended while the controller was down", async () => {
    const { repos, issues } = bare.controller.services;
    const now = "2026-01-01T00:00:00.000Z";
    const base = IssueSchema.parse((await bare.json("POST", "/v1/projects/app/issues", { title: "Interrupted" })).body);
    const finished = (id: string, state: AgentRun["state"], extra: Partial<AgentRun> = {}): AgentRun => ({
      id,
      projectId: "app",
      prompt: "p",
      mode: null,
      model: null,
      attachments: [],
      sessionId: "sess-r",
      resumedSessionId: null,
      claudeAccountId: null,
      state,
      startedAt: now,
      endedAt: now,
      usage: null,
      result: null,
      error: null,
      archivedAt: null,
      ...extra,
    });
    repos.agentRuns.save(finished("run_reconcile1", "failed", { error: "The controller restarted before this finished" }));
    repos.issues.save({ ...base, status: "in_progress", assignee: "claude", agentRunId: "run_reconcile1", agentState: "running" });
    const other = IssueSchema.parse((await bare.json("POST", "/v1/projects/app/issues", { title: "Finished meanwhile" })).body);
    repos.agentRuns.save(finished("run_reconcile2", "succeeded", { result: "Done offline" }));
    repos.issues.save({ ...other, status: "in_progress", assignee: "claude", agentRunId: "run_reconcile2", agentState: "running" });

    expect(issues.reconcile()).toBe(2);
    expect(issues.get(base.id)).toMatchObject({ status: "todo", agentState: "failed", sessionId: "sess-r" });
    expect(issues.get(base.id).comments.at(-1)?.body).toContain("controller restarted");
    expect(issues.get(other.id)).toMatchObject({ status: "in_review", agentState: "succeeded" });
    expect(issues.get(other.id).comments.at(-1)).toMatchObject({ author: "claude", body: "Done offline" });
    expect(issues.reconcile()).toBe(0);
  });
});
