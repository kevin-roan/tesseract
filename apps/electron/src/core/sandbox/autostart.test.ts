import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SandboxContext } from "./types";
import { planAutostart, runAutostart } from "./autostart";
import { failed, FakeDocker, ok, readyReport, tempStack, type TempStack } from "./test-support";

const PROJECT = "tesseract-test-auto";
let stack: TempStack;
afterEach(() => stack?.cleanup());

function setup(docker: FakeDocker, options: { builtAt?: string | null; envFile?: string; project?: string; env?: boolean } = {}): SandboxContext {
  stack = tempStack();
  const context = stack.context(docker.deps());
  if (options.env !== false) {
    mkdirSync(dirname(context.envFile), { recursive: true });
    writeFileSync(context.envFile, `TESSERACT_MODE=local\nTESSERACT_COMPOSE_PROJECT=${PROJECT}\n`);
  }
  const record = {
    envFile: options.envFile ?? context.envFile,
    project: options.project ?? PROJECT,
    mode: "local",
    image: "tesseract-test/sandbox:latest",
    builtAt: options.builtAt === undefined ? "2026-10-06T00:00:00.000Z" : options.builtAt,
    components: [],
  };
  mkdirSync(dirname(context.configFile as string), { recursive: true });
  writeFileSync(context.configFile as string, JSON.stringify({ sandboxStack: record }));
  return context;
}

const exited = (args: string[]) => (args[0] === "ps" ? ok(`${PROJECT}-sandbox-1\texited\tExited (0)\tsandbox\n`) : undefined);

describe("planAutostart", () => {
  it("starts a stopped stack that Tesseract built", async () => {
    const docker = new FakeDocker().onRun(exited);
    expect(await planAutostart(setup(docker), true)).toEqual({ kind: "start", project: PROJECT });
    expect(docker.calls[0]?.args).toContain(`label=com.docker.compose.project=${PROJECT}`);
  });

  it("starts when the stack has no containers yet", async () => {
    expect(await planAutostart(setup(new FakeDocker()), true)).toEqual({ kind: "start", project: PROJECT });
  });

  it("does nothing when the setting is off", async () => {
    const docker = new FakeDocker().onRun(exited);
    expect(await planAutostart(setup(docker), false)).toEqual({ kind: "skip", reason: "disabled" });
    expect(docker.calls).toHaveLength(0);
  });

  it("never touches a stack Tesseract didn't create", async () => {
    const reason = { kind: "skip", reason: "not-managed" };
    expect(await planAutostart(setup(new FakeDocker(), { builtAt: null }), true)).toEqual(reason);
    stack.cleanup();
    expect(await planAutostart(setup(new FakeDocker(), { envFile: "/elsewhere/.env" }), true)).toEqual(reason);
    stack.cleanup();
    expect(await planAutostart(setup(new FakeDocker(), { project: "tesseract" }), true)).toEqual(reason);
    stack.cleanup();
    expect(await planAutostart(setup(new FakeDocker(), { env: false }), true)).toEqual(reason);
    stack.cleanup();
    stack = tempStack();
    expect(await planAutostart(stack.context(new FakeDocker().deps()), true)).toEqual(reason);
  });

  it("skips when Docker isn't reachable", async () => {
    const docker = new FakeDocker();
    const context = setup(docker);
    context.deps = docker.deps({ probeDocker: async () => readyReport({ daemon: "stopped", daemonError: "Cannot connect" }) });
    expect(await planAutostart(context, true)).toEqual({ kind: "skip", reason: "docker-unreachable", detail: "Cannot connect" });
    context.deps = docker.deps({ probeDocker: async () => Promise.reject(new Error("no docker")) });
    expect((await planAutostart(context, true)).kind).toBe("skip");
  });

  it("skips a running sandbox", async () => {
    const docker = new FakeDocker().onRun((args) => (args[0] === "ps" ? ok(`${PROJECT}-sandbox-1\trunning\tUp 1 minute (healthy)\tsandbox\n`) : undefined));
    expect(await planAutostart(setup(docker), true)).toEqual({ kind: "skip", reason: "running" });
  });
});

describe("runAutostart", () => {
  it("runs compose up --detach and reports progress", async () => {
    const docker = new FakeDocker().onRun(exited);
    docker.onStream((_args, options) => {
      options.onStderr?.("Container started");
      return { code: 0 };
    });
    const lines: string[] = [];
    const outcome = await runAutostart(setup(docker), true, { onLog: (line) => lines.push(line) });
    expect(outcome.kind).toBe("started");
    expect(docker.streams).toHaveLength(1);
    expect(docker.streams[0]?.args).toEqual(expect.arrayContaining(["up", "--detach"]));
    expect(docker.streams[0]?.args).toContain(PROJECT);
    expect(lines).toContain("Container started");
    expect(lines[0]).toMatch(/Starting/);
  });

  it("returns the compose error instead of throwing", async () => {
    const docker = new FakeDocker().onRun(exited);
    docker.onStream((_args, options) => {
      options.onStderr?.("port is already allocated");
      return { code: 1 };
    });
    const outcome = await runAutostart(setup(docker), true);
    expect(outcome).toMatchObject({ kind: "failed", project: PROJECT });
    expect(outcome.kind === "failed" && outcome.message).toMatch(/port is already allocated/);
  });

  it("doesn't run compose when the plan skips", async () => {
    const docker = new FakeDocker().onRun((args) => (args[0] === "ps" ? failed("daemon gone") : undefined));
    const outcome = await runAutostart(setup(docker), true);
    expect(outcome.kind).toBe("skip");
    expect(docker.streams).toHaveLength(0);
  });
});
