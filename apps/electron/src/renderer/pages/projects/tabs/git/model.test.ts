import type { GitDetails, Project } from "@tesseract/protocol";
import { sampleProject } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { commitMeta, gitFileCode, gitFileKind, gitFileTone, gitTabView, syncLabel } from "./model";

const file = (index: string, worktree: string) => ({ path: "a", index, worktree });

describe("git model", () => {
  it("builds codes, tones and kinds like the GTK app", () => {
    expect(gitFileCode(file(" ", "M"))).toBe("M");
    expect(gitFileCode(file("?", "?"))).toBe("??");
    expect(gitFileCode(file(" ", " "))).toBe("?");
    expect(gitFileTone(file("?", "?"))).toBe("info");
    expect(gitFileTone(file("U", "U"))).toBe("danger");
    expect(gitFileTone(file("D", " "))).toBe("danger");
    expect(gitFileTone(file("A", "M"))).toBe("success");
    expect(gitFileTone(file(" ", "M"))).toBe("warning");
    expect(gitFileKind(file("A", "U"))).toBe("Conflict");
    expect(gitFileKind(file(" ", "M"))).toBe("Modified");
    expect(gitFileKind(file("?", "?"))).toBe("Untracked");
    expect(gitFileKind(file("T", " "))).toBe("Type changed");
    expect(gitFileKind(file("X", " "))).toBe("X");
  });

  it("labels ahead and behind", () => {
    expect(syncLabel(0, 0)).toBeNull();
    expect(syncLabel(2, 0)).toBe("↑2");
    expect(syncLabel(1, 3)).toBe("↑1 ↓3");
  });

  it("formats commit meta with a short sha", () => {
    const now = Date.parse("2026-09-23T12:00:00Z");
    expect(commitMeta({ sha: "fedd96b1234", subject: "x", author: "Dev", date: "2026-09-23T11:00:00Z" }, now)).toBe("fedd96b · Dev · 1h ago");
    expect(commitMeta({ sha: "fedd96b1234", subject: "x", author: "Dev", date: "2026-09-01T11:00:00Z" }, now)).toBe("fedd96b · Dev · 2026-09-01");
  });

  it("shows the not-a-repository notice without groups", () => {
    const project: Project = { ...sampleProject, git: null };
    const view = gitTabView(project, null, null);
    expect(view.hasGit).toBe(false);
    expect(view.notice).toEqual({ message: "Not a git repository", tone: "neutral" });
  });

  it("only says Clean once the details loaded", () => {
    const loading = gitTabView(sampleProject, null, null);
    expect(loading.loading).toBe(true);
    expect(loading.subtitle).toBe("main · In sync");
    const details: GitDetails = { branch: null, ahead: 1, behind: 0, files: [], log: [] };
    const loaded = gitTabView(sampleProject, details, null);
    expect(loaded.loading).toBe(false);
    expect(loaded.subtitle).toBe("detached · ↑1 · Clean");
  });

  it("keeps the summary subtitle and warns on a failed fetch", () => {
    const view = gitTabView(sampleProject, null, "boom");
    expect(view.loading).toBe(false);
    expect(view.notice).toEqual({ message: "Couldn't read git status: boom", tone: "warning" });
    expect(view.subtitle).toBe("main · In sync");
  });
});
