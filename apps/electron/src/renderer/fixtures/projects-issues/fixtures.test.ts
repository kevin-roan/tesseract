import { IssueDetailSchema, IssueListSchema, IssueSchema } from "@tesseract/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { fixtureFetch } from "../fetch";
import { resetIssuesWorld } from "./data";

const call = async (method: string, path: string, body?: unknown) => {
  const response = await fixtureFetch(`http://127.0.0.1:7700${path}`, {
    method,
    headers: {},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: new AbortController().signal,
  });
  return { status: response.status, body: JSON.parse((await response.text()) || "null") };
};

describe("projects-issues fixtures", () => {
  afterEach(() => resetIssuesWorld());

  it("lists valid issues per project and filters by assignee", async () => {
    const all = await call("GET", "/v1/issues?projectId=tesseract");
    expect(IssueListSchema.parse(all.body).length).toBeGreaterThan(5);
    const claude = await call("GET", "/v1/issues?projectId=tesseract&assignee=claude");
    expect((claude.body as { assignee: string }[]).every((issue) => issue.assignee === "claude")).toBe(true);
  });

  it("creates, updates, comments and deletes", async () => {
    const created = await call("POST", "/v1/projects/tesseract/issues", { title: "New", assignee: "claude" });
    expect(created.status).toBe(201);
    const issue = IssueSchema.parse(created.body);
    expect(issue).toMatchObject({ number: 9, status: "todo" });
    const moved = await call("PATCH", `/v1/issues/${issue.id}`, { status: "done" });
    expect(moved.body).toMatchObject({ status: "done" });
    expect(moved.body.completedAt).not.toBeNull();
    await call("POST", `/v1/issues/${issue.id}/comments`, { body: "Looks good" });
    const detail = IssueDetailSchema.parse((await call("GET", `/v1/issues/${issue.id}`)).body);
    expect(detail.comments.map((comment) => comment.body)).toEqual(["Looks good"]);
    expect((await call("DELETE", `/v1/issues/${issue.id}`)).status).toBe(200);
    expect((await call("GET", `/v1/issues/${issue.id}`)).status).toBe(404);
  });

  it("refuses to dispatch while Claude is running", async () => {
    expect((await call("POST", "/v1/issues/iss_tesseract3/dispatch", {})).status).toBe(409);
    expect((await call("POST", "/v1/issues/iss_tesseract4/dispatch", {})).body).toMatchObject({ assignee: "claude", agentState: "running" });
  });
});
