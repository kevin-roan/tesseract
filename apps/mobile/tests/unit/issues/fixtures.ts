import type { Issue, IssueComment, IssueDetail } from "@tesseract/protocol";

export const PROJECT_ID = "mobile";

export const sampleIssue: Issue = {
  id: "iss_a1b2c3",
  projectId: PROJECT_ID,
  number: 12,
  title: "Fix the login screen",
  description: "The **submit** button does nothing.",
  status: "todo",
  priority: "high",
  assignee: "claude",
  labels: ["bug"],
  sortOrder: 1,
  agentRunId: null,
  agentState: null,
  sessionId: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  completedAt: null,
};

export const makeIssue = (overrides: Partial<Issue>): Issue => ({ ...sampleIssue, ...overrides });

export const sampleComment: IssueComment = {
  id: "isc_x1y2z3",
  issueId: sampleIssue.id,
  author: "claude",
  body: "Finished.",
  agentRunId: "run_q1w2e3r4t5",
  createdAt: "2026-10-20T11:00:00.000Z",
};

export const sampleIssueDetail: IssueDetail = { ...sampleIssue, comments: [sampleComment] };
