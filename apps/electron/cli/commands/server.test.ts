import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli, tempSandbox, testContext, type Sandbox } from "../testing";
import { serverOptions } from "./server";

const core = vi.hoisted(() => ({
  writeStack: vi.fn(),
  runBuild: vi.fn(),
  composeStatus: vi.fn(),
  composeDown: vi.fn(),
  tailscaleVolumeExists: vi.fn(async () => false),
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

vi.mock("../server/plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../server/plan")>()),
  resolveTailscale: () => null,
}));

let sandbox: Sandbox;

beforeEach(() => {
  sandbox = tempSandbox({ PATH: "", TS_AUTHKEY: "tskey-auth-env", TS_TAILNET_DOMAIN: "example.ts.net" });
  Object.values(core).forEach((mock) => mock.mockClear());
});

afterEach(() => sandbox.cleanup());

describe("serverOptions", () => {
  it("reads flags first and falls back to the environment", () => {
    const options = serverOptions(
      testContext(sandbox, { values: new Map([["authkey", "tskey-flag"], ["with", "none"]]), flags: new Set(["build", "no-host-shell"]) }),
    );
    expect(options).toMatchObject({
      mode: "tailscale",
      authKey: "tskey-flag",
      tailnetDomain: "example.ts.net",
      components: [],
      build: true,
      hostShell: false,
      httpsPort: 8443,
    });
  });

  it("rejects bad modes and ports", () => {
    expect(() => serverOptions(testContext(sandbox, { values: new Map([["mode", "public"]]) }))).toThrow(/unknown mode public/);
    expect(() => serverOptions(testContext(sandbox, { values: new Map([["host-https-port", "70000"]]) }))).toThrow(/--host-https-port/);
  });
});

describe("tesseract server", () => {
  it("prints the plan without changing anything on --dry-run", async () => {
    const result = await runCli(sandbox, ["server", "install", "--dry-run", "--with", "none", "--claude-token", "sk-ant-oat-1"]);
    expect(result.code).toBe(0);
    const out = result.out.join("\n");
    expect(out).toContain("Dry run: nothing was changed.");
    expect(out).toContain("TESSERACT_MODE=tailscale");
    expect(out).toContain("TS_TAILNET_DOMAIN=example.ts.net");
    expect(out).toContain("TS_AUTHKEY=…");
    expect(out).toContain("CLAUDE_CODE_OAUTH_TOKEN=…");
    expect(out).not.toContain("sk-ant-oat-1");
    expect(out).not.toContain("tskey-auth-env");
    expect(out).toContain("WITH_ANDROID=false");
    expect(out).toContain("tesseract-host-shell.service");
    expect(out).toContain("The tailscale command was not found");
    expect(core.writeStack).not.toHaveBeenCalled();
    expect(core.runBuild).not.toHaveBeenCalled();
  });

  it("skips the host shell with --no-host-shell", async () => {
    const result = await runCli(sandbox, ["server", "install", "--dry-run", "--no-host-shell"]);
    expect(result.out).toContain("Host shell: skipped (--no-host-shell)");
  });

  it("refuses to install without Docker", async () => {
    const result = await runCli(sandbox, ["server", "install"]);
    expect(result.code).toBe(1);
    expect(result.err[0]).toMatch(/^tesseract: Docker is not ready/);
    expect(core.writeStack).not.toHaveBeenCalled();
  });

  it("rejects unknown subcommands", async () => {
    const result = await runCli(sandbox, ["server", "deploy"]);
    expect(result.code).toBe(64);
    expect(result.err[0]).toBe("tesseract: tesseract server: unknown subcommand: deploy");
  });
});
