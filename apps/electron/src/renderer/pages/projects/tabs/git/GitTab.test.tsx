import { sampleProject } from "@theone/protocol/fixtures";
import { render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { GitTab } from "./GitTab";

MotionGlobalConfig.skipAnimations = true;

describe("GitTab", () => {
  it("renders the working tree and commits", () => {
    render(
      <GitTab
        project={sampleProject}
        details={{
          branch: "prod/storefront-fixes",
          ahead: 0,
          behind: 0,
          files: [
            { path: ".env", index: " ", worktree: "M" },
            { path: "feature_deploy.md", index: "?", worktree: "?" },
          ],
          log: [{ sha: "fedd96b0000", subject: "chore; eas updates", author: "Dev", date: "2026-09-21T12:00:00Z" }],
        }}
      />,
    );
    expect(screen.getByText("Working tree")).toBeTruthy();
    expect(screen.getByText("prod/storefront-fixes · In sync")).toBeTruthy();
    expect(screen.getByText("??")).toBeTruthy();
    expect(screen.getByText("Untracked")).toBeTruthy();
    expect(screen.getByText("chore; eas updates")).toBeTruthy();
  });

  it("shows the empty labels", () => {
    render(<GitTab project={sampleProject} details={{ branch: "main", ahead: 0, behind: 0, files: [], log: [] }} />);
    expect(screen.getByText("Nothing to commit, working tree clean.")).toBeTruthy();
    expect(screen.getByText("No commits yet.")).toBeTruthy();
  });

  it("hides the groups outside a repository", () => {
    render(<GitTab project={{ ...sampleProject, git: null }} details={null} />);
    expect(screen.getByText("Not a git repository")).toBeTruthy();
    expect(screen.queryByText("Working tree")).toBeNull();
  });
});
