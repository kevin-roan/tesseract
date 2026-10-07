import { describe, expect, it } from "vitest";
import { PullProgress, socketPathFromHost, splitImageRef } from "./pull";

describe("PullProgress", () => {
  it("computes the byte fraction over layers from Engine API events", () => {
    const progress = new PullProgress();
    progress.push({ status: "Pulling from theone/sandbox", id: "latest" });
    progress.push({ id: "aaaaaaaaaaaa", status: "Pulling fs layer" });
    progress.push({ id: "bbbbbbbbbbbb", status: "Pulling fs layer" });
    expect(progress.fraction()).toBe(0);
    progress.push({ id: "aaaaaaaaaaaa", status: "Downloading", progressDetail: { current: 50, total: 100 } });
    progress.push({ id: "bbbbbbbbbbbb", status: "Downloading", progressDetail: { current: 0, total: 300 } });
    expect(progress.fraction()).toBeCloseTo(50 / 400);
    progress.push({ id: "aaaaaaaaaaaa", status: "Download complete" });
    progress.push({ id: "bbbbbbbbbbbb", status: "Pull complete" });
    expect(progress.fraction()).toBe(1);
    expect(progress.detail).toBe("bbbbbbbbbbbb: Pull complete");
  });

  it("falls back to counting finished layers without sizes and records errors", () => {
    const progress = new PullProgress();
    progress.push({ id: "aaaaaaaaaaaa", status: "Pulling fs layer" });
    progress.push({ id: "bbbbbbbbbbbb", status: "Already exists" });
    expect(progress.fraction()).toBe(0.5);
    progress.push({ error: "manifest unknown" });
    expect(progress.error).toBe("manifest unknown");
  });
});

describe("image refs and engine sockets", () => {
  it("splits refs into fromImage and tag", () => {
    expect(splitImageRef("ghcr.io/theone/sandbox:0.1.0")).toEqual({ fromImage: "ghcr.io/theone/sandbox", tag: "0.1.0" });
    expect(splitImageRef("localhost:5000/sandbox")).toEqual({ fromImage: "localhost:5000/sandbox", tag: "latest" });
    expect(splitImageRef("a/b@sha256:abc")).toEqual({ fromImage: "a/b@sha256:abc", tag: null });
  });

  it("maps docker hosts to socket paths", () => {
    expect(socketPathFromHost("unix:///run/user/1000/docker.sock", "linux")).toBe("/run/user/1000/docker.sock");
    expect(socketPathFromHost("npipe:////./pipe/dockerDesktopLinuxEngine", "win32")).toBe("\\\\.\\pipe\\dockerDesktopLinuxEngine");
    expect(socketPathFromHost("tcp://10.0.0.2:2376", "linux")).toBeNull();
    expect(socketPathFromHost(null, "darwin")).toBe("/var/run/docker.sock");
  });
});
