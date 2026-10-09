import { describe, expect, it } from "vitest";
import type { HostShellState } from "../../../../../shared/contracts/hostShell";
import { HOST_REPO_LABELS as L } from "./labels";
import { gitSummary, gitTrigger, hostPathFor, hostRepoButton, hostShellBlocker } from "./model";

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
    const buttons = (["shell", "pull", "push", "commit"] as const).map((id) => hostRepoButton(id, null, null));
    expect(buttons.every((button) => button.disabled && button.tooltip === L.noCopy)).toBe(true);
    expect(gitTrigger(null, null)).toMatchObject({ disabled: true, tooltip: L.noCopy });
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
