import { describe, expect, test } from "bun:test";
import {
  createId,
  CreateIssueCommentSchema,
  CreateIssueSchema,
  DispatchIssueSchema,
  isIdOfKind,
  IssueQuerySchema,
  LIMITS,
  restPaths,
  routePatterns,
  SERVER_EVENT_TYPES,
  ServerEventSchema,
  UpdateIssueSchema,
  type Issue,
} from "../src/index";

const sampleIssue: Issue = {
  id: createId("issue"),
  projectId: "mobile",
  number: 12,
  title: "Dark mode",
  description: "",
  status: "todo",
  priority: "high",
  assignee: "claude",
  labels: ["ui"],
  sortOrder: -1,
  agentRunId: null,
  agentState: null,
  sessionId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
};

describe("issues", () => {
  test("ids, routes and events", () => {
    expect(isIdOfKind("issue", sampleIssue.id)).toBe(true);
    expect(createId("issueComment")).toStartWith("isc_");
    expect(restPaths.issues({ projectId: "mobile", assignee: "claude" })).toBe("/v1/issues?projectId=mobile&assignee=claude");
    expect(restPaths.projectIssues("mobile")).toBe("/v1/projects/mobile/issues");
    expect(restPaths.issueDispatch(sampleIssue.id)).toBe(`/v1/issues/${sampleIssue.id}/dispatch`);
    expect(routePatterns.rest.issueComments).toBe("/v1/issues/:id/comments");
    expect(SERVER_EVENT_TYPES).toEqual(expect.arrayContaining(["issue.updated", "issue.deleted", "issue.commented"]));
    expect(ServerEventSchema.safeParse({ type: "issue.updated", issue: sampleIssue }).success).toBe(true);
    expect(ServerEventSchema.safeParse({ type: "issue.deleted", id: sampleIssue.id, projectId: "mobile" }).success).toBe(true);
  });

  test("create, update, comment and dispatch bodies", () => {
    expect(CreateIssueSchema.parse({ title: "  Trimmed ", labels: ["a", "a", "b"] })).toEqual({ title: "Trimmed", labels: ["a", "b"] });
    expect(CreateIssueSchema.safeParse({ title: " " }).success).toBe(false);
    expect(CreateIssueSchema.safeParse({ title: "x".repeat(LIMITS.maxIssueTitleLength + 1) }).success).toBe(false);
    expect(UpdateIssueSchema.safeParse({}).success).toBe(false);
    expect(UpdateIssueSchema.parse({ assignee: null })).toEqual({ assignee: null });
    expect(UpdateIssueSchema.safeParse({ sortOrder: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(CreateIssueCommentSchema.safeParse({ body: "hi", author: "system" }).success).toBe(false);
    expect(DispatchIssueSchema.parse({})).toEqual({});
    expect(IssueQuerySchema.safeParse({ status: "doing" }).success).toBe(false);
  });
});
