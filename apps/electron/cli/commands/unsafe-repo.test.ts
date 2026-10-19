import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli, tempSandbox, type Sandbox } from "../testing";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(), spawn: vi.fn() }));

vi.mock("../../src/core/process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/process")>()),
  runCommand: mocks.runCommand,
}));

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawn: mocks.spawn,
}));

const LINKED = { id: "app", path: "/home/me/app", created: true };
const PAIRING = { link: "tesseract://pair?url=x&token=t&name=box%20(host)", url: "http://100.64.0.1:7702", localUrl: "http://100.64.0.1:7702", name: "box (host)" };

let sandbox: Sandbox;

function respond(...outputs: unknown[]): void {
  for (const output of outputs) mocks.runCommand.mockResolvedValueOnce({ code: 0, stdout: `${JSON.stringify(output)}\n`, stderr: "", timedOut: false });
}

beforeEach(() => {
  sandbox = tempSandbox({ TESSERACT_CONTROLLER_COMMAND: "tesseract-controller" });
  mocks.spawn.mockReturnValue({ on: vi.fn(), unref: vi.fn() });
});

afterEach(() => {
  sandbox.cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("tesseract --unsafe-repo", () => {
  it("links the directory and reuses a running host workspace", async () => {
    respond(LINKED, PAIRING);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const result = await runCli(sandbox, ["--unsafe-repo", "--name", "App"]);
    expect(result.code).toBe(0);
    expect(mocks.runCommand.mock.calls[0]?.[1]).toEqual(["host", "workspace", "add", expect.any(String), "--name", "App", "--json"]);
    expect(mocks.runCommand.mock.calls[1]?.[1]).toEqual(["host", "workspace", "pair", "--json"]);
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(result.out[0]).toBe("Linked /home/me/app as host project app");
    expect(result.out).toContain(PAIRING.link);
  });

  it("starts the host workspace when it does not answer", async () => {
    respond(LINKED, PAIRING);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue({ ok: true }));
    const result = await runCli(sandbox, ["--unsafe-repo", "--json"]);
    expect(result.code).toBe(0);
    expect(mocks.spawn).toHaveBeenCalledWith("tesseract-controller", ["host", "workspace", "serve"], expect.objectContaining({ detached: true }));
    expect(JSON.parse(result.out.join("\n"))).toMatchObject({ ...LINKED, started: true, pairing: PAIRING });
  });

  it("reports a failing controller command", async () => {
    mocks.runCommand.mockResolvedValueOnce({ code: 2, stdout: "", stderr: "error: /x does not exist\n", timedOut: false });
    const result = await runCli(sandbox, ["--unsafe-repo"]);
    expect(result.code).toBe(1);
    expect(result.err.join("\n")).toContain("host workspace: /x does not exist");
  });
});
