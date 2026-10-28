import { describe, expect, it } from "vitest";
import { workspaceAccountIds, workspaceAccounts } from "./accounts";

describe("host workspace Claude accounts", () => {
  it("mirrors the sandbox's extra accounts as name=path and skips missing dirs", () => {
    const exists = (path: string) => path !== "/home/me/.claude-gone";
    expect(workspaceAccounts("personal gone work=/data/work", "/home/me", exists)).toBe("personal=/home/me/.claude-personal,work=/data/work");
    expect(workspaceAccounts(undefined, "/home/me", exists)).toBe("");
    expect(workspaceAccounts("../bad", "/home/me", exists)).toBe("");
  });

  it("derives the controller's account ids", () => {
    expect(workspaceAccountIds("personal=/home/me/.claude-personal,work=/data/work")).toEqual(["claude", "claude-personal", "claude-work"]);
    expect(workspaceAccountIds("")).toEqual(["claude"]);
  });
});
