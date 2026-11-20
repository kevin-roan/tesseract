import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HOST_DOCKER_SPEC_HEADER, type HostDockerMessage } from "@tesseract/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isSessionRequired } from "../host/model";
import type { DockerDeps } from "./docker";
import { remoteDocker, type RemoteDockerHost, type RemoteFetch } from "./remote";
import { ContainersService, remoteStateFileIn, type ContainersTarget } from "./service";

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "remote-docker-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function ndjson(messages: HostDockerMessage[], status = 200): Response {
  return new Response(messages.map((message) => `${JSON.stringify(message)}\n`).join(""), { status, headers: { "Content-Type": "application/x-ndjson" } });
}

interface Sent {
  url: string;
  spec: unknown;
  auth: string | null;
  body: string;
}

function fakeHost(fetch: RemoteFetch) {
  const sent: Sent[] = [];
  const rejected = vi.fn();
  const host: RemoteDockerHost = { label: "mini", access: () => ({ url: "http://100.64.0.2:7701", token: "sess" }), rejected };
  const recording: RemoteFetch = async (url, init) => {
    const headers = new Headers(init.headers);
    const body = init.body ? await new Response(init.body as BodyInit).text() : "";
    sent.push({ url, spec: JSON.parse(headers.get(HOST_DOCKER_SPEC_HEADER) ?? "null"), auth: headers.get("authorization"), body });
    return fetch(url, init);
  };
  return { docker: remoteDocker(() => host, { log: () => undefined, fetch: recording }), sent, rejected };
}

describe("remote docker", () => {
  it("runs docker on the server's host and collects its output", async () => {
    const { docker, sent } = fakeHost(async () =>
      ndjson([
        { type: "stdout", data: "a" },
        { type: "stderr", data: "warn" },
        { type: "stdout", data: "b" },
        { type: "exit", code: 0, timedOut: false },
      ]),
    );
    const result = await docker.run("docker", ["ps", "-a"], { timeoutMs: 5_000, input: "secret", extraEnv: { TUNNEL_TOKEN: "t" } });
    expect(result).toEqual({ code: 0, stdout: "a\nb\n", stderr: "warn\n", timedOut: false });
    expect(sent[0]).toEqual({
      url: "http://100.64.0.2:7701/v1/host/docker",
      spec: { args: ["ps", "-a"], env: { TUNNEL_TOKEN: "t" }, timeoutMs: 5_000 },
      auth: "Bearer sess",
      body: "secret",
    });
  });

  it("streams lines and a stdin file", async () => {
    const dir = tempDir();
    const bundle = join(dir, "bundle.tar.gz");
    writeFileSync(bundle, "BUNDLE");
    const { docker, sent } = fakeHost(async () =>
      ndjson([
        { type: "stdout", data: "step 1" },
        { type: "exit", code: 2, timedOut: false },
      ]),
    );
    const lines: string[] = [];
    const result = await docker.stream("docker", ["exec", "-i", "tesseract-ct-api", "sh"], { stdinFile: bundle, onStdout: (line) => lines.push(line) });
    expect(lines).toEqual(["step 1"]);
    expect(result).toEqual({ code: 2, cancelled: false, error: null });
    expect(sent[0]?.body).toBe("BUNDLE");
  });

  it("drops a refused session and asks for the PIN again", async () => {
    const { docker, rejected } = fakeHost(async () => new Response(JSON.stringify({ code: "unauthorized", message: "no" }), { status: 401 }));
    const error = await docker.run("docker", ["ps"]).catch((caught: unknown) => caught);
    expect(isSessionRequired(error)).toBe(true);
    expect(rejected).toHaveBeenCalled();
  });

  it("explains an older server and an unreachable one", async () => {
    const old = fakeHost(async () => new Response("", { status: 404 }));
    await expect(old.docker.run("docker", ["ps"])).rejects.toThrow(/older Tesseract/);
    const down = fakeHost(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(down.docker.run("docker", ["ps"])).rejects.toThrow(/Couldn't reach mini: ECONNREFUSED/);
  });

  it("reports a connection lost before the exit", async () => {
    const { docker } = fakeHost(async () => ndjson([{ type: "stdout", data: "half" }]));
    const result = await docker.run("docker", ["ps"]);
    expect(result.code).toBeNull();
    expect(result.stderr).toMatch(/Lost the connection to mini/);
  });

  it("only runs docker", async () => {
    const { docker } = fakeHost(async () => ndjson([]));
    await expect(docker.run("colima", ["status"])).rejects.toThrow(/Only docker/);
  });
});

describe("containers on another machine", () => {
  function deps(log: string[][]): DockerDeps {
    return {
      log: () => undefined,
      run: async (_file, args) => {
        log.push([...args]);
        if (args[0] === "info") return { code: 0, stdout: JSON.stringify({ "sysbox-runc": {} }), stderr: "", timedOut: false };
        return { code: 0, stdout: "", stderr: "", timedOut: false };
      },
      stream: async (_file, args, options) => {
        log.push([...args, `stdin:${options?.stdinFile ?? ""}`]);
        return { code: 0, cancelled: false, error: null };
      },
    };
  }

  it("keeps each server's route state apart from this computer's", () => {
    const a = remoteStateFileIn("/state", "http://100.64.0.2:7701");
    expect(a).toMatch(/^\/state\/containers-[0-9a-f]{12}\.json$/);
    expect(remoteStateFileIn("/state", "http://100.64.0.3:7701")).not.toBe(a);
  });

  it("follows the target on every call and builds from a packed context remotely", async () => {
    const dir = tempDir();
    const localCalls: string[][] = [];
    const remoteCalls: string[][] = [];
    const cleanup = vi.fn(async () => undefined);
    let target: ContainersTarget = { docker: deps(localCalls), stateFile: join(dir, "containers.json"), platform: "linux" };
    const service = new ContainersService({
      docker: deps(localCalls),
      configFile: join(dir, "config.json"),
      stateFile: join(dir, "containers.json"),
      contextDir: "/ctx",
      env: {},
      cipher: null,
      seal: false,
      target: () => target,
    });
    await service.list();
    expect(localCalls.length).toBeGreaterThan(0);
    target = {
      docker: deps(remoteCalls),
      stateFile: join(dir, "containers-remote.json"),
      platform: null,
      packContext: async (folder) => ({ file: `${folder}.tgz`, cleanup }),
    };
    const before = localCalls.length;
    await service.buildImage();
    expect(localCalls.length).toBe(before);
    expect(remoteCalls).toContainEqual(["build", "--progress=plain", "-t", "tesseract/server:1", "-", "stdin:/ctx/infra/docker/server.tgz"]);
    expect(cleanup).toHaveBeenCalled();
    await expect(service.setupVm()).rejects.toThrow(/manages its own Docker/);
  });
});
