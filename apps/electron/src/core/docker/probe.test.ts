import { describe, expect, it } from "vitest";
import type { DockerReport } from "../../shared/contracts/docker";
import { isDockerReady, phaseFromReport } from "./checks";
import { probeDocker } from "./probe";
import type { DockerHost } from "./system";
import { fakeSystem, type FakeSystemOptions } from "./testing/fake-system";
import {
  CLI_VERSION,
  INFO_JSON_DESKTOP,
  INFO_JSON_ENGINE,
  INFO_JSON_ROOTLESS,
  PERMISSION_ERROR,
  PODMAN_VERSION,
  STOPPED_ERROR,
  VERSION_JSON_ENGINE,
  VERSION_JSON_NO_SERVER,
  utf16,
} from "./testing/fixtures";

const LINUX: Partial<DockerHost> = { platform: "linux", arch: "x64", home: "/home/dev", user: "dev", release: "6.8.0" };

const runningEngine: FakeSystemOptions["commands"] = {
  "docker --version": { stdout: CLI_VERSION },
  "docker version": { stdout: VERSION_JSON_ENGINE },
  "docker info": { stdout: INFO_JSON_ENGINE },
  "id -nG": { stdout: "dev wheel docker\n" },
  "getent group docker": { stdout: "docker:x:961:dev\n" },
  "getent group 961": { stdout: "docker:x:961:dev\n" },
  "systemctl is-active docker.service": { stdout: "active\n" },
};

async function probe(options: FakeSystemOptions, host: Partial<DockerHost> = LINUX): Promise<{ report: DockerReport; calls: string[] }> {
  const system = fakeSystem({ binaries: { docker: "/usr/bin/docker" }, paths: ["/run/systemd/system"], socketGid: 961, ...options });
  const report = await probeDocker({ system, host, env: {} });
  return { report, calls: system.calls };
}

const statusOf = (report: DockerReport, id: string) => report.checks.find((check) => check.id === id);

describe("probeDocker on Linux", () => {
  it("reports a healthy engine", async () => {
    const { report, calls } = await probe({ commands: runningEngine });
    expect(report).toMatchObject({
      cli: { path: "/usr/bin/docker", version: "29.8.1" },
      daemon: "reachable",
      kind: "engine",
      context: "default",
      compose: "5.5.1",
      buildx: "0.35.0",
      server: { version: "29.8.1", os: "linux", arch: "amd64", ncpu: 16, rootless: false },
      linux: { inDockerGroup: true, socketGroup: "docker", systemd: true, serviceActive: true },
    });
    expect(report.checks.map((check) => [check.id, check.status])).toEqual([
      ["cli", "ok"],
      ["daemon", "ok"],
      ["compose", "ok"],
      ["buildx", "ok"],
      ["engine_version", "ok"],
      ["resources", "ok"],
      ["group", "ok"],
    ]);
    expect(statusOf(report, "cli")?.detail).toBe("Docker Engine 29.8.1");
    expect(statusOf(report, "daemon")?.detail).toBe("Running · linux/amd64 · default");
    expect(statusOf(report, "resources")?.detail).toBe("16 CPUs · 19 GB for containers");
    expect(isDockerReady(report, "linux")).toBe(true);
    expect(calls).not.toContain("docker compose version --short");
  });

  it("asks to install when the CLI is missing", async () => {
    const { report } = await probe({ binaries: {} });
    expect(report.cli).toBeNull();
    expect(report.checks).toEqual([{ id: "cli", status: "error", title: "Docker", detail: "Docker isn't installed", action: "install" }]);
    expect(phaseFromReport(report, "linux")).toEqual({ kind: "blocked", reason: "Docker isn't installed" });
  });

  it("flags a permission problem and a pending group change", async () => {
    const { report } = await probe({
      commands: {
        ...runningEngine,
        "docker version": { code: 1, stdout: VERSION_JSON_NO_SERVER, stderr: PERMISSION_ERROR },
        "docker compose version --short": { stdout: "2.29.7\n" },
        "docker buildx version": { stdout: "github.com/docker/buildx v0.17.1 abc" },
        "id -nG": { stdout: "dev wheel\n" },
      },
    });
    expect(report.daemon).toBe("permission");
    expect(report.daemonError).toBe(PERMISSION_ERROR);
    expect(statusOf(report, "daemon")).toMatchObject({ status: "error", action: "fix-permission" });
    expect(statusOf(report, "group")).toMatchObject({
      status: "warning",
      detail: "dev was added to the docker group; log out and back in to use it",
    });
    expect(statusOf(report, "compose")?.status).toBe("ok");
    expect(statusOf(report, "resources")).toBeUndefined();
  });

  it("offers Start when the engine is stopped and reports an old compose", async () => {
    const { report } = await probe({
      commands: {
        ...runningEngine,
        "docker version": { code: 1, stdout: VERSION_JSON_NO_SERVER, stderr: STOPPED_ERROR },
        "docker compose version --short": { stdout: "v2.20.3\n" },
        "docker buildx version": { code: 1, stderr: "unknown command" },
        "getent group docker": { stdout: "docker:x:961:\n" },
        "id -nG": { stdout: "dev\n" },
        "systemctl is-active docker.service": { code: 3, stdout: "inactive\n" },
      },
    });
    expect(statusOf(report, "daemon")).toMatchObject({ status: "error", detail: "The Docker engine isn't running", action: "start" });
    expect(statusOf(report, "compose")).toMatchObject({
      status: "error",
      detail: "Docker Compose 2.20.3 is too old; 2.24 or newer is needed",
      action: "compose-docs",
    });
    expect(statusOf(report, "buildx")).toMatchObject({ status: "error", action: "buildx-docs" });
    expect(statusOf(report, "group")).toMatchObject({ status: "warning", detail: "dev isn't in the docker group", action: "fix-permission" });
    expect(report.linux?.serviceActive).toBe(false);
    expect(phaseFromReport(report, "linux")).toEqual({ kind: "blocked", reason: "The Docker engine isn't running" });
  });

  it("treats a timeout as unresponsive", async () => {
    const { report } = await probe({ commands: { ...runningEngine, "docker version": { code: null, timedOut: true } } });
    expect(report.daemon).toBe("unresponsive");
    expect(statusOf(report, "daemon")).toMatchObject({ detail: "The Docker engine doesn't answer", action: "start" });
  });

  it("refuses podman", async () => {
    const { report } = await probe({ commands: { ...runningEngine, "docker --version": { stdout: PODMAN_VERSION } } });
    expect(report.kind).toBe("podman");
    expect(statusOf(report, "podman")?.status).toBe("error");
    expect(isDockerReady(report, "linux")).toBe(false);
  });

  it("warns about rootless docker", async () => {
    const { report } = await probe({
      commands: { ...runningEngine, "docker info": { stdout: INFO_JSON_ROOTLESS }, "systemctl --user is-active docker.service": { stdout: "active" } },
    });
    expect(report.kind).toBe("rootless");
    expect(statusOf(report, "group")).toBeUndefined();
    expect(statusOf(report, "rootless")?.status).toBe("warning");
    expect(report.linux?.serviceActive).toBe(true);
    expect(isDockerReady(report, "linux")).toBe(true);
  });

  it("warns when Docker Desktop has little memory", async () => {
    const { report } = await probe({ commands: { ...runningEngine, "docker info": { stdout: INFO_JSON_DESKTOP } } });
    expect(report.kind).toBe("desktop");
    expect(statusOf(report, "resources")).toMatchObject({
      status: "warning",
      detail: "The sandbox is limited to 6 GB (it asks for 8 GB) · raise it in Docker Desktop › Settings › Resources",
    });
  });
});

describe("probeDocker on Windows and macOS", () => {
  const WINDOWS: Partial<DockerHost> = { platform: "win32", arch: "x64", home: "C:\\Users\\dev", user: "dev", release: "10.0.22631" };

  it("requires WSL 2 on Windows", async () => {
    const { report } = await probe(
      {
        binaries: { docker: "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe" },
        commands: {
          ...runningEngine,
          "docker info": { stdout: INFO_JSON_DESKTOP },
          "powershell": { stdout: "True\r\nFalse\r\n" },
        },
      },
      WINDOWS,
    );
    expect(report.windows).toMatchObject({ wsl: null, virtualization: true });
    expect(statusOf(report, "wsl")).toMatchObject({ status: "error", action: "install-wsl" });
    expect(isDockerReady(report, "win32")).toBe(false);
    expect(isDockerReady(report, "linux")).toBe(true);
  });

  it("accepts a current WSL", async () => {
    const { report } = await probe(
      {
        binaries: { docker: "C:\\docker.exe", wsl: "C:\\Windows\\System32\\wsl.exe" },
        commands: {
          ...runningEngine,
          "docker info": { stdout: INFO_JSON_DESKTOP },
          "wsl --version": { stdout: utf16("WSL version: 2.6.1.0\r\n") },
          powershell: { stdout: "True\r\n" },
        },
      },
      WINDOWS,
    );
    expect(statusOf(report, "wsl")).toMatchObject({ status: "ok", detail: "WSL 2.6.1.0" });
  });

  it("blocks the install on old Windows builds", async () => {
    const { report } = await probe({ binaries: {}, commands: { powershell: { stdout: "True" } } }, { ...WINDOWS, release: "10.0.19044" });
    expect(statusOf(report, "cli")).toEqual({
      id: "cli",
      status: "error",
      title: "Docker",
      detail: "Docker Desktop needs Windows 10 22H2 (build 19045) or Windows 11 23H2 (build 22631) or newer",
    });
  });

  it("finds Docker Desktop on macOS while it is stopped", async () => {
    const { report } = await probe(
      {
        binaries: { docker: "/usr/local/bin/docker" },
        paths: ["/Applications/Docker.app"],
        commands: {
          "docker --version": { stdout: CLI_VERSION },
          "docker version": { code: 1, stdout: VERSION_JSON_NO_SERVER, stderr: STOPPED_ERROR },
          "docker compose version --short": { stdout: "2.39.2" },
          "docker buildx version": { stdout: "github.com/docker/buildx v0.28.0 x" },
          "sw_vers -productVersion": { stdout: "15.1\n" },
        },
      },
      { platform: "darwin", arch: "arm64", home: "/Users/dev", user: "dev", release: "24.1.0" },
    );
    expect(report.kind).toBe("desktop");
    expect(report.mac).toEqual({ desktopApp: "/Applications/Docker.app", minOs: "14.0.0" });
    expect(statusOf(report, "daemon")?.action).toBe("start");
  });
});
