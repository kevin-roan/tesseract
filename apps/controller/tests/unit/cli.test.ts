import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { SandboxStatus } from "@theone/protocol";
import { redactVncPasswords, REDACTED } from "../../src/cli/api";
import { formatStatus, runCli, USAGE, type Output } from "../../src/cli/commands";
import { callLocalApi, CliError, fetchLocalApi, isControllerUp, requireToken } from "../../src/cli/local-api";
import { flushOutput } from "../../src/cli/output";
import { loadConfig } from "../../src/config";
import { VERSION } from "../../src/version";
import { makeTempDir, removeTempDirs } from "../helpers";

const TOKEN = "cli-unit-token-0123456789abcdefghijklmnopq";
const ENTRY = join(import.meta.dir, "..", "..", "src", "index.ts");

type Reply = { status: number; body: string; type?: string };
let reply: Reply = { status: 200, body: "{}" };
const seen: { method: string; path: string; auth: string | null; body: string }[] = [];
let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      seen.push({ method: request.method, path: `${url.pathname}${url.search}`, auth: request.headers.get("authorization"), body: await request.text() });
      return new Response(reply.body, { status: reply.status, headers: { "Content-Type": reply.type ?? "application/json" } });
    },
  });
});

afterAll(() => server.stop(true));

afterEach(() => {
  removeTempDirs();
  seen.length = 0;
  reply = { status: 200, body: "{}" };
});

function env(extra: Record<string, string> = {}): Record<string, string> {
  return {
    THEONE_WORKSPACE: makeTempDir("cli-unit"),
    THEONE_HOST: "127.0.0.1",
    THEONE_PORT: String(server.port),
    THEONE_TOKEN: TOKEN,
    THEONE_SANDBOX_ID: "unit-box",
    ...extra,
  };
}

function capture(): Output & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (text) => stdout.push(text), err: (text) => stderr.push(text) };
}

const STATUS: SandboxStatus = {
  sandboxId: "box",
  hostname: "host",
  version: "1.0.0",
  startedAt: "2024-01-01T00:00:00.000Z",
  uptimeSec: 185,
  resources: {
    cpu: { cores: 4, load1: 0.5, load5: 0.25, load15: 0.125 },
    memory: { totalBytes: 8 * 1024 ** 3, usedBytes: 2 * 1024 ** 3 },
    disk: { path: "/workspace", totalBytes: 100 * 1024 ** 3, usedBytes: 10 * 1024 ** 3 },
  },
  display: {
    display: ":1",
    available: true,
    width: 1280,
    height: 800,
    vnc: { available: false, port: 5901, password: "secret" },
    webPath: "/ui/vnc",
  },
  tools: [
    { name: "node", version: "22.1.0" },
    { name: "wine", version: null },
  ],
  counts: { projects: 2, runningProcesses: 1, activeBuilds: 0, terminals: 3, agentRuns: 0 },
};

describe("formatting", () => {
  test("formatStatus renders every section", () => {
    const text = formatStatus(STATUS);
    expect(text).toContain("Sandbox   box (host) · controller 1.0.0 · up 3 min");
    expect(text).toContain("CPU       4 cores · load 0.50 0.25 0.13");
    expect(text).toContain("Memory    2.0 GiB / 8.0 GiB");
    expect(text).toContain("Disk      10.0 GiB / 100.0 GiB (/workspace)");
    expect(text).toContain("Display   :1 up 1280x800 · VNC 5901 down");
    expect(text).toContain("Work      2 projects · 1 processes · 0 builds · 3 terminals · 0 agent runs");
    expect(text).toContain("Tools     node 22.1.0, wine missing");
    expect(text).not.toContain("secret");
    const down = formatStatus({ ...STATUS, display: { ...STATUS.display, available: false, width: null, height: null } });
    expect(down).toContain("Display   :1 down · VNC 5901 down");
    const sizeless = formatStatus({ ...STATUS, display: { ...STATUS.display, width: null, height: null } });
    expect(sizeless).toContain("Display   :1 up · VNC");
  });

  test("redactVncPasswords walks arrays and nested objects only where vnc.password is a string", () => {
    const input = {
      vnc: { password: "a", port: 1 },
      list: [{ display: { vnc: { password: "b" } } }, "text", 3, null],
      other: { vnc: { password: null } },
      notObject: { vnc: "string" },
    };
    expect(redactVncPasswords(input)).toEqual({
      vnc: { password: REDACTED, port: 1 },
      list: [{ display: { vnc: { password: REDACTED } } }, "text", 3, null],
      other: { vnc: { password: null } },
      notObject: { vnc: "string" },
    });
    expect(redactVncPasswords("plain")).toBe("plain");
  });
});

describe("local API helpers", () => {
  test("requireToken reads the environment or explains how to get one", () => {
    expect(requireToken(loadConfig(env()))).toBe(TOKEN);
    const without = loadConfig({ ...env(), THEONE_TOKEN: "" });
    expect(() => requireToken(without)).toThrow(CliError);
    expect(() => requireToken(without)).toThrow(/No API token/);
  });

  test("callLocalApi sends the bearer token and JSON, and maps error bodies", async () => {
    const config = loadConfig(env());
    reply = { status: 200, body: JSON.stringify({ ok: 1 }) };
    expect(await callLocalApi<{ ok: number }>(config, "POST", "/v1/events", { a: 1 })).toEqual({ ok: 1 });
    expect(seen[0]).toEqual({ method: "POST", path: "/v1/events", auth: `Bearer ${TOKEN}`, body: '{"a":1}' });

    reply = { status: 200, body: "" };
    expect(await callLocalApi(config, "GET", "/v1/status")).toBeNull();

    reply = { status: 409, body: JSON.stringify({ error: { code: "conflict", message: "busy" } }) };
    await expect(callLocalApi(config, "GET", "/v1/x")).rejects.toThrow("conflict: busy");

    reply = { status: 502, body: "<html>bad gateway</html>", type: "text/html" };
    await expect(callLocalApi(config, "GET", "/v1/x")).rejects.toThrow("HTTP 502");
  });

  test("an unreachable controller is a CliError naming the URL", async () => {
    const closed = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("") });
    const port = closed.port;
    closed.stop(true);
    const config = loadConfig({ ...env(), THEONE_PORT: String(port) });
    await expect(fetchLocalApi(config, "GET", "/v1/status")).rejects.toThrow(`Controller not reachable at http://127.0.0.1:${port}`);
    expect(await isControllerUp(config)).toBe(false);
  });

  test("isControllerUp reflects the health status", async () => {
    const config = loadConfig(env());
    expect(await isControllerUp(config)).toBe(true);
    reply = { status: 503, body: "{}" };
    expect(await isControllerUp(config)).toBe(false);
  });
});

describe("runCli", () => {
  test("help and version aliases need no configuration", async () => {
    for (const command of ["--help", "-h", "help"]) {
      const output = capture();
      expect(await runCli([command], { env: { THEONE_PORT: "bogus" }, output })).toBe(0);
      expect(output.stdout).toEqual([USAGE]);
    }
    for (const command of ["--version", "-v", "version"]) {
      const output = capture();
      expect(await runCli([command], { env: {}, output })).toBe(0);
      expect(output.stdout).toEqual([VERSION]);
    }
  });

  test("configuration errors exit 1 with the message", async () => {
    const output = capture();
    expect(await runCli(["status"], { env: { THEONE_PORT: "bogus" }, output })).toBe(1);
    expect(output.stderr[0]).toStartWith("error: THEONE_PORT");
  });

  test("unknown options exit 2 with the usage", async () => {
    for (const argv of [["status", "--nope"], ["pair", "--jsonx"], ["token", "--rotate=1"], ["emit", "--bogus", "x"]]) {
      const output = capture();
      expect(await runCli(argv, { env: env(), output })).toBe(2);
      expect(output.stderr[0]).toContain("Usage:");
    }
  });

  test("status prints text or redacted JSON", async () => {
    reply = { status: 200, body: JSON.stringify(STATUS) };
    const text = capture();
    expect(await runCli(["status"], { env: env(), output: text })).toBe(0);
    expect(text.stdout[0]).toContain("Sandbox   box (host)");
    const json = capture();
    expect(await runCli(["status", "--json"], { env: env(), output: json })).toBe(0);
    expect(JSON.parse(json.stdout[0] ?? "").display.vnc.password).toBe(REDACTED);

    reply = { status: 200, body: "" };
    const empty = capture();
    expect(await runCli(["status"], { env: env(), output: empty })).toBe(1);
    expect(empty.stderr[0]).toBe("error: Empty status response");
  });

  test("emit validates before posting and reports what it sent", async () => {
    const invalid = capture();
    expect(await runCli(["emit", "--status", "building"], { env: env(), output: invalid })).toBe(2);
    expect(invalid.stderr[0]).toContain("Invalid event");
    expect(seen).toHaveLength(0);

    reply = { status: 202, body: "" };
    const plain = capture();
    expect(await runCli(["emit", "--status", "building", "--message", "compiling"], { env: env(), output: plain })).toBe(0);
    expect(plain.stdout).toEqual(["emitted building"]);
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ status: "building", message: "compiling", project: null });

    const full = capture();
    const argv = ["emit", "--status", "building", "--message", "m", "--project", "app", "--stage", "compile", "--platform", "android"];
    expect(await runCli(argv, { env: env(), output: full })).toBe(0);
    expect(full.stdout).toEqual(["emitted building for app"]);
    expect(JSON.parse(seen[1]?.body ?? "")).toEqual({ status: "building", message: "m", project: "app", stage: "compile", platform: "android" });

    reply = { status: 400, body: JSON.stringify({ error: { code: "bad_request", message: "nope" } }) };
    const rejected = capture();
    expect(await runCli(["emit", "--status", "building", "--message", "m"], { env: env(), output: rejected })).toBe(1);
    expect(rejected.stderr).toEqual(["error: bad_request: nope"]);
  });

  test("pair warns when the controller is down and prints JSON on request", async () => {
    const closed = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("") });
    const port = String(closed.port);
    closed.stop(true);
    const output = capture();
    expect(await runCli(["pair"], { env: env({ THEONE_PORT: port }), output })).toBe(0);
    expect(output.stderr).toContain("warning: the controller is not answering on the local port yet");
    expect(output.stdout.join("\n")).toContain("theone://");

    const json = capture();
    expect(await runCli(["pair", "--json"], { env: env(), output: json })).toBe(0);
    expect(JSON.parse(json.stdout[0] ?? "")).toMatchObject({ name: "unit-box" });
  });

  test("token --rotate warns that THEONE_TOKEN still overrides the file", async () => {
    const output = capture();
    expect(await runCli(["token", "--rotate"], { env: env(), output })).toBe(0);
    expect(output.stdout[0]).toContain("Wrote a new token");
    expect(output.stderr[0]).toContain("THEONE_TOKEN is set");

    const quiet = capture();
    expect(await runCli(["token", "--rotate"], { env: env({ THEONE_TOKEN: "" }), output: quiet })).toBe(0);
    expect(quiet.stderr).toEqual([]);
  });

  test("api refuses binary output to a terminal and renders empty error bodies", async () => {
    reply = { status: 200, body: "\x89PNG", type: "image/png" };
    const terminal = capture();
    expect(await runCli(["api", "GET", "/v1/display/screenshot"], { env: env(), output: terminal })).toBe(1);
    expect(terminal.stderr[0]).toContain("redirect stdout to a file");

    reply = { status: 500, body: "" };
    const empty = capture();
    expect(await runCli(["api", "DELETE", "/v1/processes/x"], { env: env(), output: empty })).toBe(1);
    expect(empty.stderr[0]).toMatch(/^HTTP 500/);

    reply = { status: 204, body: "" };
    const none = capture();
    expect(await runCli(["api", "post", "/v1/auth/ticket"], { env: env(), output: none })).toBe(0);
    expect(none.stdout).toEqual([]);

    reply = { status: 200, body: "plain text\n", type: "text/plain" };
    const text = capture();
    expect(await runCli(["api", "GET", "/v1/x?y=1"], { env: env(), output: text })).toBe(0);
    expect(text.stdout).toEqual(["plain text"]);
    expect(seen.at(-1)?.path).toBe("/v1/x?y=1");
  });
});

describe("entrypoint", () => {
  async function runEntry(args: string[], extraEnv: Record<string, string> = {}) {
    const proc = Bun.spawn(["bun", ENTRY, ...args], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, ...extraEnv },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    return { stdout, stderr, code };
  }

  test("exits with the command's code after flushing output", async () => {
    expect(await runEntry(["--version"])).toEqual({ stdout: `${VERSION}\n`, stderr: "", code: 0 });
    const unknown = await runEntry(["frobnicate"]);
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toStartWith('Unknown command "frobnicate"');
    const badConfig = await runEntry(["status"], { THEONE_LOG_LEVEL: "loud" });
    expect(badConfig.code).toBe(1);
    expect(badConfig.stderr).toContain("THEONE_LOG_LEVEL");
  });

  test("flushOutput resolves even with nothing queued", async () => {
    await flushOutput();
    await flushOutput();
  });
});
