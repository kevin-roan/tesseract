import { describe, expect, it } from "vitest";
import type { HostShellState } from "../../../../../shared/contracts/hostShell";
import { HOST_REPO_LABELS as L } from "./labels";
import { gitSummary, gitTrigger, hostFolder, hostPathFor, hostRepoButton, hostShellBlocker, isTerminalAction, terminalFailure } from "./model";

const state = (patch: Partial<HostShellState> = {}): HostShellState => ({
  status: "running",
  pairing: { link: "tesseract://host", url: "http://127.0.0.1:7799", name: "box", pinSet: true },
  error: null,
  log: [],
  autostart: true,
  sessionExpiresAt: null,
  ...patch,
});

describe("host repo model", () => {
  it("finds the host copy of a project", () => {
    const links = [{ projectId: "app", hostPath: "/home/me/app", pushedAt: null, gotAt: null, confidential: false, files: 1 }];
    expect(hostPathFor(links, "app")).toBe("/home/me/app");
    expect(hostPathFor(links, "other")).toBeNull();
    expect(hostPathFor(undefined, "app")).toBeNull();
  });

  it("disables every action without a host copy", () => {
    const buttons = (["claude", "shell", "pull", "push", "commit"] as const).map((id) => hostRepoButton(id, null, null));
    expect(buttons.every((button) => button.disabled && button.tooltip === L.noCopy)).toBe(true);
    expect(gitTrigger(null, null)).toMatchObject({ disabled: true, tooltip: L.noCopy });
  });

  it("names the host folder by its last segment", () => {
    expect(hostFolder("/home/me/code/app")).toEqual({ name: "app", path: "/home/me/code/app" });
    expect(hostFolder("/home/me/code/app/")).toEqual({ name: "app", path: "/home/me/code/app/" });
    expect(hostFolder("C:\\Users\\me\\app")).toEqual({ name: "app", path: "C:\\Users\\me\\app" });
    expect(hostFolder("/")).toEqual({ name: "/", path: "/" });
    expect(hostFolder(null)).toBeNull();
  });

  it("offers Claude on the host copy", () => {
    expect(hostRepoButton("claude", "/home/me/app", null)).toMatchObject({
      label: L.claude,
      icon: "agents",
      disabled: false,
      busy: false,
      tooltip: "Chat with Claude in /home/me/app on this computer",
    });
    expect(hostRepoButton("claude", "/home/me/app", "claude")).toMatchObject({ label: L.opening, busy: true, disabled: true });
    expect(hostRepoButton("shell", "/home/me/app", "claude")).toMatchObject({ busy: false, disabled: true });
  });

  it("tells terminal actions from git actions", () => {
    expect(isTerminalAction("claude")).toBe(true);
    expect(isTerminalAction("shell")).toBe(true);
    expect(isTerminalAction("pull")).toBe(false);
    expect(terminalFailure("claude", "boom")).toBe(L.claudeFailed("boom"));
    expect(terminalFailure("shell", "boom")).toBe(L.shellFailed("boom"));
  });

  it("marks the running action busy and blocks the others", () => {
    expect(hostRepoButton("pull", "/home/me/app", "pull")).toMatchObject({ busy: true, label: L.pulling, disabled: true });
    expect(hostRepoButton("shell", "/home/me/app", "pull")).toMatchObject({ busy: false, label: L.shell, disabled: true, tooltip: L.shellTooltip("/home/me/app") });
    expect(hostRepoButton("commit", "/home/me/app", null)).toMatchObject({ busy: false, label: L.commit, disabled: false });
  });

  it("shows the running git action on the Git button", () => {
    expect(gitTrigger("/home/me/app", null)).toMatchObject({ label: L.git, busy: false, disabled: false, tooltip: L.gitTooltip("/home/me/app") });
    expect(gitTrigger("/home/me/app", "commit")).toMatchObject({ label: L.committing, busy: true, disabled: false });
    expect(gitTrigger("/home/me/app", "shell")).toMatchObject({ label: L.git, busy: false });
    expect(gitTrigger("/home/me/app", "claude")).toMatchObject({ label: L.git, busy: false });
  });

  it("explains why the host shell can't open", () => {
    expect(hostShellBlocker(null)).toBe(L.hostLoading);
    expect(hostShellBlocker(state({ status: "stopped" }))).toBe(L.hostStopped);
    expect(hostShellBlocker(state({ pairing: { link: "", url: "", name: "", pinSet: false } }))).toBe(L.hostNoPin);
    expect(hostShellBlocker(state())).toBeNull();
    expect(hostShellBlocker(state({ status: "external" }))).toBeNull();
  });

  it("summarises git output with its last line", () => {
    expect(gitSummary("Updating a..b\nFast-forward\n 1 file changed\n")).toBe("1 file changed");
    expect(gitSummary("\n")).toBe(L.upToDate);
  });
});
