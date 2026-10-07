import { describe, expect, it } from "vitest";
import type { DockerPhase, DockerReport } from "../../shared/contracts/docker";
import { IpcError } from "../../shared/ipc-types";
import { probeDocker } from "./probe";
import { startEngine } from "./start";
import type { DockerHost } from "./system";
import { fakeSystem, type FakeSystem } from "./testing/fake-system";
import { CLI_VERSION, INFO_JSON_ENGINE, STOPPED_ERROR, VERSION_JSON_ENGINE, VERSION_JSON_NO_SERVER } from "./testing/fixtures";

const LINUX: Partial<DockerHost> = { platform: "linux", arch: "x64", home: "/home/dev", user: "dev", release: "6.8.0" };

function stoppedLinux(): FakeSystem {
  return fakeSystem({
    binaries: { docker: "/usr/bin/docker", pkexec: "/usr/bin/pkexec" },
    paths: ["/run/systemd/system"],
    socketGid: 961,
    commands: {
      "docker --version": { stdout: CLI_VERSION },
      "docker version": { code: 1, stdout: VERSION_JSON_NO_SERVER, stderr: STOPPED_ERROR },
      "docker info": { stdout: INFO_JSON_ENGINE },
      "docker compose version --short": { stdout: "2.29.7" },
      "docker buildx version": { stdout: "github.com/docker/buildx v0.17.1 x" },
      "id -nG": { stdout: "dev docker" },
      "getent group": { stdout: "docker:x:961:dev" },
      "systemctl is-active": { code: 3, stdout: "inactive" },
    },
  });
}

async function run(system: FakeSystem, host = LINUX) {
  const phases: DockerPhase[] = [];
  const reports: DockerReport[] = [];
  const logs: string[] = [];
  const options = { system, host, env: {}, onPhase: (p: DockerPhase) => phases.push(p), onReport: (r: DockerReport) => reports.push(r), onLog: (l: string) => logs.push(l) };
  const report = await probeDocker({ system, host, env: {} });
  const result = await startEngine(report, options).catch((error: unknown) => error);
  return { result, phases, reports, logs };
}

describe("startEngine", () => {
  it("starts the system service with pkexec and polls until the engine answers", async () => {
    const system = stoppedLinux();
    let polls = 0;
    system.set("pkexec systemctl start docker.service", { code: 0 });
    system.set("docker version", () => {
      polls += 1;
      return polls > 3 ? { stdout: VERSION_JSON_ENGINE } : { code: 1, stdout: VERSION_JSON_NO_SERVER, stderr: STOPPED_ERROR };
    });
    const { result, phases, reports } = await run(system);
    expect(result).toEqual({ kind: "ready" });
    expect(phases[0]).toEqual({ kind: "starting", since: 1_000_000 });
    expect(system.calls).toContain("pkexec systemctl start docker.service");
    expect(reports.at(-1)?.daemon).toBe("reachable");
  });

  it("times out after 120 s on Linux", async () => {
    const system = stoppedLinux();
    system.set("pkexec systemctl start docker.service", { code: 0 });
    const { result, logs } = await run(system);
    expect(result).toEqual({ kind: "blocked", reason: "The engine didn't start within 120 seconds" });
    expect(system.clock.now - 1_000_000).toBeGreaterThanOrEqual(120_000);
    expect(logs.some((line) => line.startsWith("Waiting for the engine"))).toBe(true);
  });

  it("reports a dismissed password prompt as cancelled", async () => {
    const system = stoppedLinux();
    system.set("pkexec systemctl start docker.service", { code: 126 });
    const { result } = await run(system);
    expect(result).toBeInstanceOf(IpcError);
    expect((result as IpcError).code).toBe("cancelled");
  });

  it("falls back to the manual command without a polkit agent", async () => {
    const system = stoppedLinux();
    system.set("pkexec systemctl start docker.service", { code: 127, stderr: "Error executing command as another user: No authentication agent found." });
    const { result, logs } = await run(system);
    expect(result).toMatchObject({ kind: "blocked" });
    expect(logs).toContain("sudo systemctl start docker.service");
  });

  it("uses systemctl --user for rootless and Docker Desktop for Linux", async () => {
    const system = stoppedLinux();
    system.set("docker version", { code: 1, stdout: VERSION_JSON_NO_SERVER.replace('"default"', '"desktop-linux"'), stderr: STOPPED_ERROR });
    system.set("systemctl --user start docker-desktop", { code: 1, stderr: "Unit docker-desktop.service not found." });
    const { result } = await run(system);
    expect(result).toEqual({ kind: "blocked", reason: "The command failed: Unit docker-desktop.service not found." });
  });

  it("launches Docker Desktop.exe detached on Windows", async () => {
    const exe = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe";
    const system = fakeSystem({
      binaries: { docker: "C:\\docker.exe" },
      paths: [exe],
      commands: {
        "docker --version": { stdout: CLI_VERSION },
        "docker version": { code: 1, stdout: VERSION_JSON_NO_SERVER, stderr: STOPPED_ERROR },
        "docker desktop version": { code: 1, stderr: "unknown command" },
      },
    });
    const host: Partial<DockerHost> = { platform: "win32", arch: "x64", home: "C:\\Users\\dev", user: "dev", release: "10.0.26100" };
    const { result } = await run(system, host);
    expect(system.launched).toEqual(["Docker Desktop.exe"]);
    expect(result).toEqual({ kind: "blocked", reason: "The engine didn't start within 180 seconds" });
  });

  it("does not try to start an engine it can't reach for permission reasons", async () => {
    const system = stoppedLinux();
    system.set("docker version", { code: 1, stderr: "permission denied while trying to connect to the docker API at unix:///var/run/docker.sock" });
    const { result } = await run(system);
    expect(result).toEqual({ kind: "blocked", reason: "You don't have access to the Docker engine" });
    expect(system.calls.some((call) => call.startsWith("pkexec"))).toBe(false);
  });

  it("stops polling when cancelled", async () => {
    const system = stoppedLinux();
    const controller = new AbortController();
    system.set("pkexec systemctl start docker.service", () => {
      controller.abort();
      return { code: 0 };
    });
    const report = await probeDocker({ system, host: LINUX, env: {} });
    await expect(startEngine(report, { system, host: LINUX, env: {}, signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
  });
});
