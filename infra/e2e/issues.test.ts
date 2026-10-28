import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ApiError } from "@tesseract/client";
import type { Issue } from "@tesseract/protocol";
import { client, SECONDS } from "./lib/env";
import { recordEvents, waitFor, type EventRecorder } from "./lib/wait";

const PROJECT_ID = "issues-e2e";
const RUN_DEADLINE_MS = 90 * SECONDS;

let recorder: EventRecorder;

beforeAll(async () => {
  recorder = await recordEvents();
  try {
    await client.createProject({ name: PROJECT_ID });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 409)) throw error;
  }
});

afterAll(async () => {
  recorder.close();
  await client.deleteProject(PROJECT_ID, { force: true }).catch(() => undefined);
});

describe("project issues", () => {
  let first: Issue;

  test("create, number, list and update issues", async () => {
    first = await client.createIssue(PROJECT_ID, { title: "Write the README", labels: ["docs", "docs"] });
    expect(first).toMatchObject({ projectId: PROJECT_ID, number: 1, status: "backlog", priority: "none", assignee: null, labels: ["docs"] });
    await recorder.next("issue.updated", (event) => event.type === "issue.updated" && event.issue.id === first.id);

    const second = await client.createIssue(PROJECT_ID, { title: "Fix login", priority: "urgent", status: "todo", assignee: "me" });
    expect(second.number).toBe(2);

    const listed = await client.listIssues({ projectId: PROJECT_ID });
    expect(listed.map((issue) => issue.id)).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(await client.listIssues({ projectId: PROJECT_ID, assignee: "me" })).toHaveLength(1);

    const done = await client.updateIssue(second.id, { status: "done" });
    expect(done.completedAt).not.toBeNull();
    const reopened = await client.updateIssue(second.id, { status: "todo" });
    expect(reopened.completedAt).toBeNull();

    const comment = await client.commentOnIssue(first.id, { body: "Mention the setup script." });
    expect(comment.author).toBe("me");
    const detail = await client.getIssue(first.id);
    expect(detail.comments.map((entry) => entry.id)).toContain(comment.id);
  });

  test("backlog issues assigned to Claude wait until they are moved to todo", async () => {
    const assigned = await client.updateIssue(first.id, { assignee: "claude" });
    expect(assigned.agentRunId).toBeNull();
    expect(assigned.status).toBe("backlog");
  });

  test(
    "moving a Claude issue to todo dispatches a run that ends (fails cleanly without credentials)",
    async () => {
      const moved = await client.updateIssue(first.id, { status: "todo" });
      expect(moved.agentRunId).not.toBeNull();
      expect(moved.status).toBe("in_progress");
      const run = await client.getAgentRun(moved.agentRunId!);
      expect(run.projectId).toBe(PROJECT_ID);
      expect(run.prompt).toContain("Write the README");

      const settled = await waitFor(
        "issue run to finish",
        async () => {
          const issue = await client.getIssue(first.id);
          return issue.agentState !== "running" && issue.agentState !== null ? issue : null;
        },
        RUN_DEADLINE_MS,
      );
      if (settled.agentState === "failed") {
        expect(settled.status).toBe("todo");
        expect(settled.comments.some((entry) => entry.author === "system" && entry.agentRunId === moved.agentRunId)).toBe(true);
      } else {
        expect(settled.agentState).toBe("succeeded");
        expect(settled.status).toBe("in_review");
        expect(settled.comments.some((entry) => entry.author === "claude")).toBe(true);
      }
    },
    RUN_DEADLINE_MS + 15 * SECONDS,
  );

  test("validation and missing issues", async () => {
    await expect(client.createIssue(PROJECT_ID, { title: "  " })).rejects.toMatchObject({ status: 400 });
    await expect(client.createIssue("no-such-project", { title: "x" })).rejects.toMatchObject({ status: 404 });
    await expect(client.getIssue("iss_missing00")).rejects.toMatchObject({ status: 404 });
  });

  test("deleting an issue publishes issue.deleted", async () => {
    const deleted = await client.deleteIssue(first.id);
    expect(deleted.id).toBe(first.id);
    await recorder.next("issue.deleted", (event) => event.type === "issue.deleted" && event.id === first.id);
    await expect(client.getIssue(first.id)).rejects.toMatchObject({ status: 404 });
  });
});
