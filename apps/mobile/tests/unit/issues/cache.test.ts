import type { Issue, IssueDetail } from "@tesseract/protocol";

import { cachedIssue } from "@/features/issues/api/cache";
import { issueKeys } from "@/features/issues/api/query-keys";
import { applyServerEvent } from "@/features/sandbox/api/cache";

import { createTestQueryClient } from "../sandbox/helpers";
import { PROJECT_ID, makeIssue, sampleComment, sampleIssue, sampleIssueDetail } from "./fixtures";

const SID = "sbx_issues";

describe("issue events", () => {
  it("upserts issue.updated into matching project lists and the loaded detail", () => {
    const client = createTestQueryClient();
    const other = makeIssue({ id: "iss_other", projectId: "notes" });
    client.setQueryData(issueKeys.list(SID, { projectId: PROJECT_ID }), []);
    client.setQueryData(issueKeys.list(SID, { projectId: "notes" }), [other]);
    client.setQueryData(issueKeys.detail(SID, sampleIssue.id), sampleIssueDetail);

    const running: Issue = { ...sampleIssue, status: "in_progress", agentState: "running", agentRunId: "run_1" };
    applyServerEvent(client, SID, { type: "issue.updated", issue: running });

    expect(client.getQueryData(issueKeys.list(SID, { projectId: PROJECT_ID }))).toEqual([running]);
    expect(client.getQueryData(issueKeys.list(SID, { projectId: "notes" }))).toEqual([other]);
    expect(client.getQueryData<IssueDetail>(issueKeys.detail(SID, sampleIssue.id))).toEqual({
      ...running,
      comments: sampleIssueDetail.comments,
    });
  });

  it("removes deleted issues and appends new comments once", () => {
    const client = createTestQueryClient();
    client.setQueryData(issueKeys.list(SID, { projectId: PROJECT_ID }), [sampleIssue]);
    client.setQueryData(issueKeys.detail(SID, sampleIssue.id), { ...sampleIssue, comments: [] });

    const event = { type: "issue.commented", comment: sampleComment, projectId: PROJECT_ID } as const;
    applyServerEvent(client, SID, event);
    applyServerEvent(client, SID, event);
    expect(client.getQueryData<IssueDetail>(issueKeys.detail(SID, sampleIssue.id))?.comments).toEqual([sampleComment]);

    applyServerEvent(client, SID, { type: "issue.deleted", id: sampleIssue.id, projectId: PROJECT_ID });
    expect(client.getQueryData(issueKeys.list(SID, { projectId: PROJECT_ID }))).toEqual([]);
    expect(client.getQueryData(issueKeys.detail(SID, sampleIssue.id))).toBeUndefined();
  });

  it("finds an issue in the detail or any list", () => {
    const client = createTestQueryClient();
    client.setQueryData(issueKeys.list(SID, { projectId: PROJECT_ID }), [sampleIssue]);
    expect(cachedIssue(client, SID, sampleIssue.id)).toEqual(sampleIssue);
    expect(cachedIssue(client, SID, "iss_missing")).toBeUndefined();
  });
});
