import {
  canDispatch,
  claudeWillStart,
  countOpenIssues,
  defaultStatusFor,
  filterIssues,
  groupIssues,
  initialCollapsed,
  issueIdentifier,
  parseLabels,
  sameLabels,
} from "@/features/issues/utils/issues";

import { makeIssue, sampleIssue } from "./fixtures";

describe("issue utils", () => {
  it("builds the project identifier", () => {
    expect(issueIdentifier(sampleIssue)).toBe("MOBILE-12");
  });

  it("groups by status in board order, sorted by sortOrder then newest number", () => {
    const issues = [
      makeIssue({ id: "iss_1", status: "done", number: 1 }),
      makeIssue({ id: "iss_2", status: "todo", sortOrder: 2, number: 2 }),
      makeIssue({ id: "iss_3", status: "todo", sortOrder: 1, number: 3 }),
      makeIssue({ id: "iss_4", status: "todo", sortOrder: 1, number: 4 }),
      makeIssue({ id: "iss_5", status: "backlog", number: 5 }),
    ];
    const groups = groupIssues(issues);
    expect(groups.map((group) => group.status)).toEqual(["backlog", "todo", "done"]);
    expect(groups[1].issues.map((issue) => issue.id)).toEqual(["iss_4", "iss_3", "iss_2"]);
  });

  it("filters by assignee", () => {
    const issues = [makeIssue({ id: "iss_c" }), makeIssue({ id: "iss_m", assignee: "me" }), makeIssue({ id: "iss_n", assignee: null })];
    expect(filterIssues(issues, "all")).toHaveLength(3);
    expect(filterIssues(issues, "claude").map((issue) => issue.id)).toEqual(["iss_c"]);
    expect(filterIssues(issues, "mine").map((issue) => issue.id)).toEqual(["iss_m"]);
  });

  it("counts open issues and collapses only closed groups", () => {
    expect(countOpenIssues([sampleIssue, makeIssue({ status: "done" }), makeIssue({ status: "canceled" })])).toBe(1);
    expect(initialCollapsed()).toEqual({
      backlog: false,
      todo: false,
      in_progress: false,
      in_review: false,
      done: true,
      canceled: true,
    });
  });

  it("follows the controller's Claude rules", () => {
    expect(defaultStatusFor("claude")).toBe("todo");
    expect(defaultStatusFor(null)).toBe("backlog");
    expect(claudeWillStart("claude", "todo")).toBe(true);
    expect(claudeWillStart("claude", "backlog")).toBe(false);
    expect(claudeWillStart("claude", "done")).toBe(false);
    expect(claudeWillStart("me", "todo")).toBe(false);
    expect(canDispatch(sampleIssue)).toBe(true);
    expect(canDispatch(makeIssue({ agentState: "running" }))).toBe(false);
    expect(canDispatch(makeIssue({ status: "canceled" }))).toBe(false);
  });

  it("parses comma separated labels", () => {
    expect(parseLabels(" bug, ui ,, bug ")).toEqual(["bug", "ui"]);
    expect(sameLabels(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameLabels(["a"], ["b"])).toBe(false);
  });
});
