import { describe, expect, it } from "vitest";
import type { DockerReport } from "../../../shared/contracts/docker";
import {
  appendLog,
  blockedReason,
  checkViews,
  installChoices,
  installProgress,
  isReady,
  needsLicense,
  panelFor,
  rebootSubject,
  stepStatus,
} from "./model";

const report = (checks: DockerReport["checks"]): DockerReport => ({
  cli: { path: "/usr/bin/docker", version: "29.8.1" },
  daemon: "reachable",
  daemonError: null,
  kind: "engine",
  context: "default",
  server: null,
  compose: "2.40.3",
  buildx: "0.29.1",
  checks,
});

const OK = report([
  { id: "cli", status: "ok", title: "Docker", detail: "Docker Engine 29.8.1" },
  { id: "daemon", status: "ok", title: "Engine", detail: "Running" },
  { id: "compose", status: "ok", title: "Docker Compose", detail: "2.40.3" },
  { id: "buildx", status: "ok", title: "BuildKit", detail: "buildx 0.29.1" },
  { id: "resources", status: "warning", title: "Resources", detail: "limited" },
]);

const STOPPED = report([
  { id: "cli", status: "ok", title: "Docker", detail: "Docker Engine 29.8.1" },
  { id: "daemon", status: "error", title: "Engine", detail: "The Docker engine isn't running", action: "start" },
]);

describe("checkViews", () => {
  it("shows running placeholders before the first report", () => {
    const rows = checkViews(null, { kind: "checking" }, 0);
    expect(rows.map((row) => row.id)).toEqual(["cli", "daemon", "compose", "buildx"]);
    expect(rows.every((row) => row.status === "running")).toBe(true);
  });

  it("counts seconds on the engine row while starting", () => {
    const rows = checkViews(STOPPED, { kind: "starting", since: 1000 }, 8500);
    expect(rows[1]).toMatchObject({ status: "running", subtitle: "Starting the engine… 7s", action: null });
  });

  it("maps check actions", () => {
    expect(checkViews(STOPPED, { kind: "idle" }, 0)[1]?.action).toBe("start");
  });
});

describe("readiness", () => {
  it("is ready when the phase says so or required checks pass", () => {
    expect(isReady(null, { kind: "ready" }, "linux")).toBe(true);
    expect(isReady(OK, { kind: "idle" }, "linux")).toBe(true);
    expect(isReady(OK, { kind: "idle" }, "win32")).toBe(false);
    expect(isReady(STOPPED, { kind: "idle" }, "linux")).toBe(false);
  });

  it("reports the rail status", () => {
    expect(stepStatus(OK, { kind: "ready" }, "linux")).toBe("warning");
    expect(stepStatus(STOPPED, { kind: "starting", since: 0 }, "linux")).toBe("running");
    expect(stepStatus(STOPPED, { kind: "blocked", reason: "x" }, "linux")).toBe("error");
    expect(stepStatus(null, { kind: "checking" }, "linux")).toBeNull();
  });
});

describe("panels", () => {
  it("forces restart panels and the install panel while installing", () => {
    expect(panelFor({ kind: "needs-relogin" }, "none")).toBe("relogin");
    expect(panelFor({ kind: "needs-reboot" }, "install")).toBe("reboot");
    expect(panelFor({ kind: "installing", stage: "downloading", received: 0, total: null }, "none")).toBe("install");
    expect(panelFor({ kind: "ready" }, "install")).toBe("none");
    expect(panelFor({ kind: "blocked", reason: "x" }, "permission")).toBe("permission");
  });

  it("only surfaces blocked reasons that no check row shows", () => {
    expect(blockedReason(STOPPED, { kind: "blocked", reason: "The Docker engine isn't running" })).toBeNull();
    expect(blockedReason(STOPPED, { kind: "blocked", reason: "The engine didn't start within 120 seconds" })).toBe(
      "The engine didn't start within 120 seconds",
    );
  });
});

describe("install", () => {
  it("offers the platform options", () => {
    expect(installChoices("linux", null).map((choice) => choice.option)).toEqual(["engine", "desktop-linux", "manual"]);
    expect(installChoices("win32", null).map((choice) => choice.option)).toEqual(["desktop", "desktop-user", "manual"]);
    expect(installChoices("darwin", null)[0]?.title).toBe("Docker Desktop (recommended)");
  });

  it("names the distro in the engine subtitle", () => {
    const host = { distro: { id: "ubuntu", idLike: [], versionId: "24.04", prettyName: "Ubuntu 24.04 LTS" } } as never;
    expect(installChoices("linux", host)[0]?.subtitle).toBe("Installs Docker's packages for Ubuntu 24.04 LTS with your password");
  });

  it("requires the license for Docker Desktop only", () => {
    expect(needsLicense("desktop")).toBe(true);
    expect(needsLicense("engine")).toBe(false);
  });

  it("describes download progress", () => {
    const mb = 1024 ** 2;
    expect(installProgress({ kind: "installing", stage: "downloading", received: 412 * mb, total: 2048 * mb })).toEqual({
      label: "Downloading Docker",
      progress: 412 / 2048,
      detail: "412 MB of 2.0 GB",
    });
    expect(installProgress({ kind: "installing", stage: "installing", received: 0, total: null })?.progress).toBeNull();
    expect(installProgress({ kind: "ready" })).toBeNull();
  });

  it("names what a reboot finishes", () => {
    expect(rebootSubject({ ...OK, windows: { wsl: null, virtualization: true, desktopExe: null } })).toBe("WSL 2");
    expect(rebootSubject(OK)).toBe("Docker Desktop");
  });
});

describe("appendLog", () => {
  it("keeps the last lines", () => {
    expect(appendLog(["a", "b"], "c", 2)).toEqual(["b", "c"]);
  });
});
