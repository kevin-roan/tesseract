import { describe, expect, it } from "vitest";
import { clampGrid, ContainerShells, parseDockerHost } from "./shell";

describe("parseDockerHost", () => {
  it("defaults to the platform socket", () => {
    expect(parseDockerHost(undefined, "linux")).toEqual({ socketPath: "/var/run/docker.sock" });
    expect(parseDockerHost("", "win32")).toEqual({ socketPath: "\\\\.\\pipe\\docker_engine" });
  });

  it("reads unix sockets, named pipes and plain tcp", () => {
    expect(parseDockerHost("unix:///home/me/.docker/desktop/docker.sock\n", "linux")).toEqual({ socketPath: "/home/me/.docker/desktop/docker.sock" });
    expect(parseDockerHost("npipe:////./pipe/dockerDesktopLinuxEngine", "win32")).toEqual({ socketPath: "\\\\.\\pipe\\dockerDesktopLinuxEngine" });
    expect(parseDockerHost("tcp://10.0.0.2:2376", "linux")).toEqual({ host: "10.0.0.2", port: 2376 });
    expect(parseDockerHost("tcp://docker", "linux")).toEqual({ host: "docker", port: 2375 });
  });

  it("rejects endpoints it can't dial", () => {
    expect(() => parseDockerHost("ssh://me@box", "linux")).toThrow(/can't reach Docker/);
  });
});

describe("clampGrid", () => {
  it("keeps the grid within sane bounds", () => {
    expect(clampGrid({ cols: 120.7, rows: 40 })).toEqual({ cols: 120, rows: 40 });
    expect(clampGrid({ cols: 0, rows: Number.NaN })).toEqual({ cols: 1, rows: 1 });
    expect(clampGrid({ cols: 1e9, rows: 1e9 })).toEqual({ cols: 1000, rows: 500 });
  });
});

describe("ContainerShells", () => {
  const shells = new ContainerShells({ endpoint: () => Promise.reject(new Error("unreachable")) });
  const sink = { data() {}, exit() {} };

  it("validates the session id and name before touching Docker", async () => {
    await expect(shells.open("x", "api", { cols: 80, rows: 24 }, sink)).rejects.toThrow(/Invalid shell session/);
    await expect(shells.open("session-0001", "Bad_Name", { cols: 80, rows: 24 }, sink)).rejects.toThrow(/lowercase/);
  });

  it("ignores writes and closes for unknown sessions", () => {
    expect(() => shells.write("missing", "ls\r")).not.toThrow();
    expect(() => shells.close("missing")).not.toThrow();
  });
});
