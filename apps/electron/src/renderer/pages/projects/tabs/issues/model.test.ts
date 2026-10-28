import type { IssueComment } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { claudeRays } from "../../../../components/ClaudeMark";
import { fixtureIssue } from "../../../../fixtures/projects-issues/data";
import { EMPTY_DRAFT } from "./constants";
import {
  addLabels,
  agentIndicator,
  appendComment,
  applyIssuePatch,
  canDispatch,
  claudeHint,
  commentFollowsUp,
  descriptionUpdate,
  draftBody,
  draftStatus,
  dropUpdate,
  filterIssues,
  issueColumns,
  issueIdentifier,
  issuesView,
  knownLabels,
  normalizeLabels,
  patchIssue,
  removeIssue,
  sortOrderBetween,
  titleUpdate,
  upsertIssue,
} from "./model";
import { priorityBars } from "./priority";

const issue = (number: number, patch: Parameters<typeof fixtureIssue>[2] = {}) => fixtureIssue("mobile", number, patch, 0);

describe("issueIdentifier", () => {
  it("uppercases the project id", () => {
    expect(issueIdentifier({ projectId: "tesseract-mobile", number: 12 })).toBe("TESSERACT-MOBILE-12");
  });
});

describe("issue lists", () => {
  const list = [
    issue(1, { status: "todo", sortOrder: 20, assignee: "me" }),
    issue(2, { status: "backlog", sortOrder: 5, assignee: "claude" }),
    issue(3, { status: "todo", sortOrder: 10 }),
    issue(4, { status: "todo", sortOrder: 10, assignee: "claude" }),
  ];

  it("groups by status in board order, sorted by sortOrder then newest number", () => {
    const columns = issueColumns(list);
    expect(columns.map((column) => column.status)).toEqual(["backlog", "todo", "in_progress", "in_review", "done", "canceled"]);
    expect(columns[1]?.issues.map((entry) => entry.number)).toEqual([4, 3, 1]);
  });

  it("filters by scope", () => {
    expect(filterIssues(list, "all")).toHaveLength(4);
    expect(filterIssues(list, "claude").map((entry) => entry.number)).toEqual([2, 4]);
    expect(filterIssues(list, "mine").map((entry) => entry.number)).toEqual([1]);
  });

  it("maps the list to a view", () => {
    expect(issuesView(null, null)).toBe("loading");
    expect(issuesView(null, new Error("x"))).toBe("error");
    expect(issuesView([], null)).toBe("empty");
    expect(issuesView(list, null)).toBe("content");
  });

  it("upserts, patches and removes", () => {
    const added = upsertIssue(list, issue(5, { status: "backlog", sortOrder: 1 }));
    expect(added[0]?.number).toBe(5);
    expect(upsertIssue(added, { ...issue(5), title: "Renamed", status: "backlog", sortOrder: 1 }).find((entry) => entry.number === 5)?.title).toBe("Renamed");
    expect(patchIssue(list, list[0]!.id, { status: "backlog", sortOrder: 0 })[0]?.number).toBe(1);
    expect(removeIssue(list, list[0]!.id)).toHaveLength(3);
  });

  it("sets and clears completedAt when closing and reopening", () => {
    const closed = applyIssuePatch(issue(1), { status: "done" });
    expect(closed.completedAt).not.toBeNull();
    expect(applyIssuePatch(closed, { status: "todo" }).completedAt).toBeNull();
    expect(applyIssuePatch(issue(1), { labels: [" a ", "a", "b"] }).labels).toEqual(["a", "b"]);
  });

  it("collects known labels", () => {
    expect(knownLabels([issue(1, { labels: ["ui", "bug"] }), issue(2, { labels: ["bug"] })])).toEqual(["bug", "ui"]);
  });
});

describe("drag and drop ordering", () => {
  const list = [
    issue(1, { status: "todo", sortOrder: 0 }),
    issue(2, { status: "todo", sortOrder: 100 }),
    issue(3, { status: "todo", sortOrder: 200 }),
    issue(4, { status: "backlog", sortOrder: 0 }),
  ];
  const id = (number: number) => list[number - 1]!.id;

  it("computes a sort order between neighbours", () => {
    expect(sortOrderBetween(null, null)).toBe(0);
    expect(sortOrderBetween(null, 10)).toBe(10 - 1024);
    expect(sortOrderBetween(10, null)).toBe(10 + 1024);
    expect(sortOrderBetween(10, 20)).toBe(15);
  });

  it("moves into another column at the end or before a card", () => {
    expect(dropUpdate(list, id(4), { status: "todo", beforeId: null })).toEqual({ status: "todo", sortOrder: 1224 });
    expect(dropUpdate(list, id(4), { status: "todo", beforeId: id(2) })).toEqual({ status: "todo", sortOrder: 50 });
    expect(dropUpdate(list, id(4), { status: "todo", beforeId: id(1) })).toEqual({ status: "todo", sortOrder: -1024 });
    expect(dropUpdate(list, id(1), { status: "done", beforeId: null })).toEqual({ status: "done", sortOrder: 0 });
  });

  it("reorders inside a column and ignores no-op drops", () => {
    expect(dropUpdate(list, id(3), { status: "todo", beforeId: id(1) })).toEqual({ sortOrder: -1024 });
    expect(dropUpdate(list, id(1), { status: "todo", beforeId: null })).toEqual({ sortOrder: 1224 });
    expect(dropUpdate(list, id(2), { status: "todo", beforeId: id(3) })).toBeNull();
    expect(dropUpdate(list, id(3), { status: "todo", beforeId: null })).toBeNull();
    expect(dropUpdate(list, id(2), { status: "todo", beforeId: id(2) })).toBeNull();
    expect(dropUpdate(list, "missing", { status: "todo", beforeId: null })).toBeNull();
  });
});

describe("Claude state", () => {
  it("shows running and failed runs only", () => {
    expect(agentIndicator({ agentState: "running" })).toBe("running");
    expect(agentIndicator({ agentState: "failed" })).toBe("failed");
    expect(agentIndicator({ agentState: "succeeded" })).toBeNull();
    expect(agentIndicator({ agentState: null })).toBeNull();
  });

  it("dispatches only open issues without a running run", () => {
    expect(canDispatch({ status: "todo", agentState: null })).toBe(true);
    expect(canDispatch({ status: "todo", agentState: "running" })).toBe(false);
    expect(canDispatch({ status: "done", agentState: "failed" })).toBe(false);
  });

  it("treats comments on open Claude issues as follow-ups", () => {
    expect(commentFollowsUp({ assignee: "claude", status: "in_review" })).toBe(true);
    expect(commentFollowsUp({ assignee: "claude", status: "done" })).toBe(false);
    expect(commentFollowsUp({ assignee: "me", status: "todo" })).toBe(false);
  });

  it("hints when Claude starts", () => {
    expect(claudeHint("todo", "claude")).toBe("starts");
    expect(claudeHint("backlog", "claude")).toBe("waits");
    expect(claudeHint("done", "claude")).toBeNull();
    expect(claudeHint("todo", "me")).toBeNull();
  });
});

describe("drafts", () => {
  it("defaults the status like the controller", () => {
    expect(draftStatus({ status: null, assignee: "claude" })).toBe("todo");
    expect(draftStatus({ status: null, assignee: "none" })).toBe("backlog");
    expect(draftStatus({ status: "in_review", assignee: "claude" })).toBe("in_review");
  });

  it("builds the create body", () => {
    expect(draftBody({ ...EMPTY_DRAFT, title: "  Fix it  " })).toEqual({ title: "Fix it", priority: "none", assignee: null });
    expect(
      draftBody({ title: "Fix", description: " Body ", status: "todo", priority: "high", assignee: "claude", labels: ["bug", "bug", " ui "] }),
    ).toEqual({ title: "Fix", description: "Body", status: "todo", priority: "high", assignee: "claude", labels: ["bug", "ui"] });
  });

  it("normalizes labels from comma separated input", () => {
    expect(addLabels(["bug"], "ui, bug ,  ,docs")).toEqual(["bug", "ui", "docs"]);
    expect(normalizeLabels(Array.from({ length: 30 }, (_, index) => `l${index}`))).toHaveLength(20);
  });

  it("only sends changed titles and descriptions", () => {
    expect(titleUpdate({ title: "A" }, " A ")).toBeNull();
    expect(titleUpdate({ title: "A" }, "  ")).toBeNull();
    expect(titleUpdate({ title: "A" }, "B ")).toEqual({ title: "B" });
    expect(descriptionUpdate({ description: "x" }, "x\n")).toBeNull();
    expect(descriptionUpdate({ description: "x" }, "y")).toEqual({ description: "y" });
  });
});

describe("activity", () => {
  it("appends comments once", () => {
    const comment: IssueComment = { id: "isc_1", issueId: "iss_1", author: "me", body: "hi", agentRunId: null, createdAt: "2026-10-27T00:00:00Z" };
    const detail = { ...issue(1), comments: [] };
    const once = appendComment(detail, comment);
    expect(appendComment(once, comment).comments).toHaveLength(1);
  });
});

describe("glyph geometry", () => {
  it("fills priority bars by level", () => {
    expect(priorityBars("none").filter((bar) => bar.filled)).toHaveLength(0);
    expect(priorityBars("medium").filter((bar) => bar.filled)).toHaveLength(2);
    const high = priorityBars("high");
    expect(high.every((bar) => bar.filled)).toBe(true);
    expect(high[0]!.height).toBeLessThan(high[2]!.height);
  });

  it("draws the Claude mark rays around the center", () => {
    const rays = claudeRays();
    expect(rays).toHaveLength(10);
    expect(rays[0]).toMatchObject({ x1: 8, x2: 8 });
  });
});
