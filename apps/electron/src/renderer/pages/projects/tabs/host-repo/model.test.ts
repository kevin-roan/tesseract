import { describe, expect, it } from "vitest";
import type { HostShellState } from "../../../../../shared/contracts/hostShell";
import { HOST_REPO_LABELS as L } from "./labels";
import { gitSummary, hostPathFor, hostRepoButtons, hostShellBlocker } from "./model";

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
    const buttons = hostRepoButtons(null, null);
    expect(buttons.map((button) => button.id)).toEqual(["shell", "pull", "push"]);
    expect(buttons.every((button) => button.disabled && button.tooltip === L.noCopy)).toBe(true);
  });

  it("marks the running action busy and blocks the others", () => {
    const buttons = hostRepoButtons("/home/me/app", "pull");
    expect(buttons.find((button) => button.id === "pull")).toMatchObject({ busy: true, label: L.pulling, disabled: true });
    expect(buttons.find((button) => button.id === "shell")).toMatchObject({ busy: false, label: L.shell, disabled: true, tooltip: L.shellTooltip("/home/me/app") });
    expect(hostRepoButtons("/home/me/app", null).every((button) => !button.disabled)).toBe(true);
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
