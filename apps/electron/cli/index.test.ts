import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, tempSandbox, type Sandbox } from "./testing";
import { CLI_VERSION } from "./version";

let sandbox: Sandbox;

beforeEach(() => {
  sandbox = tempSandbox();
});

afterEach(() => sandbox.cleanup());

describe("tesseract cli dispatch", () => {
  it("prints help without arguments", async () => {
    const { code, out } = await runCli(sandbox, []);
    expect(code).toBe(0);
    expect(out[0]).toMatch(/^usage: tesseract/);
    expect(out.join("\n")).toContain("sandbox");
    expect(out.join("\n")).toContain("--sync-status");
  });

  it("prints command help", async () => {
    const viaHelp = await runCli(sandbox, ["help", "android"]);
    const viaFlag = await runCli(sandbox, ["android", "--help"]);
    expect(viaHelp.out).toEqual(viaFlag.out);
    expect(viaHelp.out.join("\n")).toContain("tesseract android avd create");
  });

  it("explains that --get runs inside the sandbox", async () => {
    const { code, err } = await runCli(sandbox, ["--get"]);
    expect(code).toBe(1);
    expect(err[0]).toContain("on this computer use tesseract --sync");
  });

  it("rejects unknown flags and commands", async () => {
    expect((await runCli(sandbox, ["--bogus"])).code).toBe(64);
    expect((await runCli(sandbox, ["frobnicate"])).code).toBe(64);
    expect((await runCli(sandbox, ["pull"])).code).toBe(64);
    const scoped = await runCli(sandbox, ["status", "--volumes"]);
    expect(scoped.code).toBe(64);
    expect(scoped.err[0]).toContain("--volumes");
  });

  it("reports usage errors as JSON with --json", async () => {
    const { code, out } = await runCli(sandbox, ["--bogus", "--json"]);
    expect(code).toBe(64);
    expect(JSON.parse(out.join("\n"))).toMatchObject({ ok: false, error: { code: "invalid_argument" } });
  });

  it("prints the version as text and JSON", async () => {
    expect((await runCli(sandbox, ["version"])).out).toEqual([`tesseract ${CLI_VERSION}`]);
    expect((await runCli(sandbox, ["--version"])).out).toEqual([`tesseract ${CLI_VERSION}`]);
    const json = await runCli(sandbox, ["version", "--json"]);
    expect(JSON.parse(json.out.join("\n"))).toEqual({ name: "tesseract", version: CLI_VERSION, platform: "linux", arch: "x64" });
  });

  it("rejects unknown subcommands of a command", async () => {
    const { code, err } = await runCli(sandbox, ["sandbox", "explode"]);
    expect(code).toBe(64);
    expect(err[0]).toContain("unknown subcommand: explode");
  });
});
