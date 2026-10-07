import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildPhase, SandboxStackStatus } from "../../src/shared/contracts/sandbox";
import { runCli, tempSandbox, type Sandbox } from "../testing";
import { buildMode, describeServices, parseComponents, phaseLine } from "./sandbox";

const core = vi.hoisted(() => ({
  readEnvValues: vi.fn(),
  writeStack: vi.fn(),
  runBuild: vi.fn(),
  composeStatus: vi.fn(),
  composeUp: vi.fn(),
  composeDown: vi.fn(),
  composeLogs: vi.fn(),
}));

vi.mock("../../src/core/sandbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/sandbox")>()),
  ...core,
  savedChoices: async (_context: unknown, base: unknown) => base,
}));

vi.mock("../../src/core/docker", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/docker")>()),
  probeDocker: vi.fn(async () => {
    throw new Error("no docker in tests");
  }),
}));

const STATUS: SandboxStackStatus = {
  configured: true,
  project: "theone",
  services: [{ service: "sandbox", container: "theone-sandbox-1", state: "running", health: "healthy" }],
};

let sandbox: Sandbox;

beforeEach(() => {
  sandbox = tempSandbox();
  Object.values(core).forEach((mock) => mock.mockReset());
});

afterEach(() => sandbox.cleanup());

describe("component selection", () => {
  it("parses lists, keywords and base-image aliases", () => {
    expect(parseComponents("whisper,android")).toEqual({ components: ["android", "whisper"], notes: [] });
    expect(parseComponents("all").components).toEqual(["android", "flutter", "mono", "whisper"]);
    expect(parseComponents("all,none,mono").components).toEqual(["mono"]);
    const chrome = parseComponents("chrome,flutter");
    expect(chrome.components).toEqual(["flutter"]);
    expect(chrome.notes[0]).toContain("base image");
  });

  it("rejects unknown components", () => {
    expect(() => parseComponents("android,qt")).toThrow(/unknown component qt/);
  });
});

describe("build helpers", () => {
  it("maps flags to a build mode", () => {
    expect(buildMode(new Set())).toBe("build");
    expect(buildMode(new Set(["pull"]))).toBe("pull");
    expect(buildMode(new Set(["existing"]))).toBe("existing");
  });

  it("describes every phase", () => {
    const phases: BuildPhase[] = [
      { kind: "building", fraction: 0.5, step: "apt-get install", cachedSteps: 0, doneSteps: 1, totalSteps: 4 },
      { kind: "pulling", fraction: null, detail: "layer 3/9" },
      { kind: "done", apiUrl: "http://127.0.0.1:7700", imageId: "sha256:1" },
      { kind: "failed", phase: "health", message: "timed out" },
    ];
    expect(phases.map(phaseLine)).toEqual([
      "Building 50% apt-get install",
      "Pulling layer 3/9",
      "Sandbox ready at http://127.0.0.1:7700",
      "health failed: timed out",
    ]);
  });

  it("renders the services table", () => {
    expect(describeServices(STATUS)).toEqual(["SERVICE  CONTAINER         STATE    HEALTH", "sandbox  theone-sandbox-1  running  healthy"]);
    expect(describeServices({ ...STATUS, services: [] })).toEqual(["No sandbox containers"]);
  });
});

describe("tesseract sandbox", () => {
  it("shows the stack status by default", async () => {
    core.composeStatus.mockResolvedValue(STATUS);
    const result = await runCli(sandbox, ["sandbox", "--json"]);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out.join("\n"))).toEqual(STATUS);
    expect(core.composeStatus).toHaveBeenCalledWith(expect.objectContaining({ contextDir: sandbox.contextDir }));
  });

  it("passes --volumes to down and streams compose output to stderr", async () => {
    core.composeDown.mockImplementation(async (_context, _volumes, callbacks: { onLog(line: string): void }) => {
      callbacks.onLog("Container theone-sandbox-1 Removed");
      return { ...STATUS, services: [] };
    });
    const result = await runCli(sandbox, ["sandbox", "down", "--volumes"]);
    expect(core.composeDown.mock.calls[0]?.[1]).toBe(true);
    expect(result.err).toContain("Container theone-sandbox-1 Removed");
    expect(result.out).toEqual(["No sandbox containers"]);
  });

  it("validates --tail", async () => {
    expect((await runCli(sandbox, ["sandbox", "logs", "--tail", "zero"])).code).toBe(64);
    core.composeLogs.mockResolvedValue(["a", "b"]);
    const result = await runCli(sandbox, ["sandbox", "logs", "--tail", "2"]);
    expect(core.composeLogs.mock.calls[0]?.[1]).toBe(2);
    expect(result.out).toEqual(["a", "b"]);
  });

  it("writes the selected components before building", async () => {
    core.readEnvValues.mockResolvedValue(null);
    core.writeStack.mockImplementation(async (context: { envFile: string }) => ({ envFile: context.envFile }));
    core.runBuild.mockImplementation(async (_context, mode, callbacks: { onPhase(phase: BuildPhase): void }) => {
      callbacks.onPhase({ kind: "preflight" });
      const done: BuildPhase = { kind: "done", apiUrl: `http://127.0.0.1:7700/${mode}`, imageId: "sha256:1" };
      callbacks.onPhase(done);
      return done;
    });
    const result = await runCli(sandbox, ["sandbox", "build", "--with", "android,chromium", "--pull"]);
    expect(result.code).toBe(0);
    expect(core.writeStack.mock.calls[0]?.[1]).toMatchObject({ components: ["android"] });
    expect(core.runBuild.mock.calls[0]?.[1]).toBe("pull");
    expect(result.err.join("\n")).toContain("chromium is part of the base image");
    expect(result.out).toEqual(["Sandbox ready at http://127.0.0.1:7700/pull"]);
  });

  it("keeps an existing configuration when no components are given", async () => {
    core.readEnvValues.mockResolvedValue({ THEONE_IMAGE: "theone/sandbox:latest" });
    core.runBuild.mockResolvedValue({ kind: "failed", phase: "build", message: "boom" } satisfies BuildPhase);
    const result = await runCli(sandbox, ["sandbox", "build"]);
    expect(core.writeStack).not.toHaveBeenCalled();
    expect(result.code).toBe(1);
    expect(result.out).toEqual(["build failed: boom"]);
  });
});
