import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { join } from "node:path";
import {
  BuildJobSchema,
  CreateProjectResponseSchema,
  DisplayStatusSchema,
  ErrorBodySchema,
  HealthSchema,
  parsePairingLink,
  ProcessInfoSchema,
  SandboxStatusSchema,
  ServerEventSchema,
  type ServerEvent,
} from "@tesseract/protocol";
import { runCli, type Output } from "../src/cli/commands";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, waitFor, writeFiles, type TestController } from "./helpers";

const VNC_PASSWORD = "vnc-s3cret-password";

let t: TestController;
let env: Record<string, string>;

type Captured = Output & { stdout: string[]; stderr: string[]; bytes: Uint8Array[] };

function capture(options: { raw?: boolean } = {}): Captured {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const bytes: Uint8Array[] = [];
  return {
    stdout,
    stderr,
    bytes,
    out: (text) => stdout.push(text),
    err: (text) => stderr.push(text),
    ...(options.raw ? { raw: async (data: Uint8Array) => void bytes.push(data) } : {}),
  };
}

async function callApi(args: string[], options: { stdin?: string; raw?: boolean; env?: Record<string, string> } = {}) {
  const output = capture(options);
  const code = await runCli(["api", ...args], {
    env: options.env ?? env,
    output,
    readStdin: async () => options.stdin ?? "",
  });
  const printed = [...output.stdout, ...output.stderr].join("\n");
  expect(printed).not.toContain(TEST_TOKEN);
  expect(printed).not.toContain(VNC_PASSWORD);
  return { code, ...output };
}

beforeAll(async () => {
  t = await startTestController({ env: { TESSERACT_VNC_PASSWORD: VNC_PASSWORD } });
  writeFiles(t.workspace, {
    "projects/webapp/package.json": JSON.stringify({ name: "webapp", version: "1.2.3", scripts: { build: "mkdir -p dist && echo '<p>hi</p>' > dist/index.html" } }),
    "projects/webapp/bun.lock": "{}",
  });
  env = {
    TESSERACT_WORKSPACE: t.workspace,
    TESSERACT_HOST: "127.0.0.1",
    TESSERACT_PORT: String(t.controller.url.port),
    TESSERACT_TOKEN: TEST_TOKEN,
    TESSERACT_PUBLIC_URL: "https://tesseract-sandbox.tail1234.ts.net",
    TESSERACT_SANDBOX_ID: "test-sandbox",
  };
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

test("pair prints a parseable deep link and a QR code", async () => {
  const json = capture();
  expect(await runCli(["pair", "--json"], { env, output: json })).toBe(0);
  const { link } = JSON.parse(json.stdout[0] ?? "{}") as { link: string };
  const parsed = parsePairingLink(link);
  expect(parsed.ok && parsed.value).toEqual({ url: "https://tesseract-sandbox.tail1234.ts.net", token: TEST_TOKEN, name: "test-sandbox" });

  const human = capture();
  expect(await runCli(["pair"], { env, output: human })).toBe(0);
  expect(human.stdout[0]).toContain("\x1b[");
  expect(human.stdout.join("\n")).toContain(link);
  expect(human.stderr.join("\n")).not.toContain("not answering");
});

test("status calls the local API", async () => {
  const human = capture();
  expect(await runCli(["status"], { env, output: human })).toBe(0);
  expect(human.stdout[0]).toContain("Sandbox   test-sandbox");
  const json = capture();
  expect(await runCli(["status", "--json"], { env, output: json })).toBe(0);
  expect(JSON.parse(json.stdout[0] ?? "{}")).toMatchObject({ sandboxId: "test-sandbox", display: { vnc: { password: "***" } } });
  expect(json.stdout[0]).not.toContain(VNC_PASSWORD);
  const denied = capture();
  expect(await runCli(["status"], { env: { ...env, TESSERACT_TOKEN: "wrong-token" }, output: denied })).toBe(1);
  expect(denied.stderr[0]).toContain("unauthorized");
});

test("emit publishes a status event", async () => {
  const socket = await t.socket("/v1/events");
  const output = capture();
  const code = await runCli(["emit", "--status", "building", "--message", "Compiling", "--project", "hello", "--platform", "windows"], { env, output });
  expect(code).toBe(0);
  const event = ServerEventSchema.parse(await socket.waitFor((message: ServerEvent) => message.type === "status"));
  expect(event.type === "status" && event.event).toMatchObject({ status: "building", message: "Compiling", project: "hello", platform: "windows" });
  socket.close();
  expect(await runCli(["emit", "--message", "no status"], { env, output: capture() })).toBe(2);
  expect(await runCli(["emit", "--bogus"], { env, output: capture() })).toBe(2);
});

test("token prints and rotates the token file", async () => {
  const workspace = makeTempDir("cli-token");
  const fileEnv = { TESSERACT_WORKSPACE: workspace };
  const first = capture();
  expect(await runCli(["token"], { env: fileEnv, output: first })).toBe(0);
  const original = first.stdout[0] ?? "";
  expect(original).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await runCli(["token", "--rotate"], { env: fileEnv, output: capture() })).toBe(0);
  const file = join(workspace, ".agent", "controller", "token");
  expect(statSync(file).mode & 0o777).toBe(0o600);
  const rotated = (await Bun.file(file).text()).trim();
  expect(rotated).not.toBe(original);
  const second = capture();
  await runCli(["token"], { env: fileEnv, output: second });
  expect(second.stdout[0]).toBe(rotated);
});

test("usage, version and unknown commands", async () => {
  const help = capture();
  expect(await runCli(["--help"], { env, output: help })).toBe(0);
  expect(help.stdout[0]).toContain("tesseract-controller pair");
  expect(await runCli(["--version"], { env, output: capture() })).toBe(0);
  expect(await runCli(["launch-rockets"], { env, output: capture() })).toBe(2);
  const bad = capture();
  expect(await runCli(["status"], { env: { ...env, TESSERACT_PORT: "99999" }, output: bad })).toBe(1);
  expect(bad.stderr[0]).toContain("TESSERACT_PORT");
});

describe("api", () => {
  test("GET prints the pretty-printed JSON response", async () => {
    const result = await callApi(["GET", "/v1/health"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(result.stdout).toHaveLength(1);
    expect(result.stdout[0]).toContain('\n  "ok": true');
    expect(HealthSchema.parse(JSON.parse(result.stdout[0] ?? ""))).toMatchObject({ ok: true, sandboxId: "test-sandbox" });
    expect((await callApi(["get", "/v1/processes?projectId=webapp"])).stdout).toEqual(["[]"]);
  });

  test("redacts the VNC password from display and status", async () => {
    const display = await callApi(["GET", "/v1/display"]);
    expect(display.code).toBe(0);
    expect(DisplayStatusSchema.parse(JSON.parse(display.stdout[0] ?? "")).vnc.password).toBe("***");
    const status = await callApi(["GET", "/v1/status"]);
    expect(SandboxStatusSchema.parse(JSON.parse(status.stdout[0] ?? "")).display.vnc.password).toBe("***");
    const direct = await t.json<{ vnc: { password: string } }>("GET", "/v1/display");
    expect(direct.body.vnc.password).toBe(VNC_PASSWORD);
  });

  test("POST takes the body from the argument or from stdin", async () => {
    const socket = await t.socket("/v1/events");
    const emitted = await callApi(["POST", "/v1/events", JSON.stringify({ project: null, status: "testing", message: "via api" })]);
    expect(emitted).toMatchObject({ code: 0, stdout: [], stderr: [] });
    const event = ServerEventSchema.parse(await socket.waitFor((message: ServerEvent) => message.type === "status"));
    expect(event.type === "status" && event.event).toMatchObject({ status: "testing", message: "via api" });
    socket.close();

    const created = await callApi(["POST", "/v1/projects", "-"], { stdin: JSON.stringify({ name: "cli-app" }) });
    expect(created.code).toBe(0);
    expect(CreateProjectResponseSchema.parse(JSON.parse(created.stdout[0] ?? "")).project.id).toBe("cli-app");
  });

  test("never prints the token, even when a response echoes it", async () => {
    const started = await callApi(["POST", "/v1/processes", JSON.stringify({ projectId: "webapp", command: `echo ${TEST_TOKEN}` })]);
    expect(started.code).toBe(0);
    expect(ProcessInfoSchema.parse(JSON.parse(started.stdout[0] ?? "")).command).toBe("echo ***");
    const denied = await callApi(["GET", "/v1/status"], { env: { ...env, TESSERACT_TOKEN: "wrong-token" } });
    expect(denied.code).toBe(1);
    expect(ErrorBodySchema.parse(JSON.parse(denied.stderr[0] ?? "")).error.code).toBe("unauthorized");
  });

  test("non-2xx answers exit 1 with the error body on stderr", async () => {
    const missing = await callApi(["DELETE", "/v1/processes/prc_missing000"]);
    expect(missing.code).toBe(1);
    expect(missing.stdout).toEqual([]);
    expect(ErrorBodySchema.parse(JSON.parse(missing.stderr[0] ?? "")).error.code).toBe("not_found");
    const invalid = await callApi(["POST", "/v1/builds", "{}"]);
    expect(invalid.code).toBe(1);
    expect(ErrorBodySchema.parse(JSON.parse(invalid.stderr[0] ?? "")).error.code).toBe("bad_request");
  });

  test("binary responses go to stdout unchanged, never to a terminal", async () => {
    const queued = await callApi(["POST", "/v1/builds", JSON.stringify({ projectId: "webapp", target: "web" })]);
    const id = BuildJobSchema.parse(JSON.parse(queued.stdout[0] ?? "")).id;
    const build = await waitFor(async () => {
      const current = BuildJobSchema.parse(JSON.parse((await callApi(["GET", `/v1/builds/${id}`])).stdout[0] ?? ""));
      return current.endedAt ? current : null;
    }, 15_000);
    expect(build.state).toBe("succeeded");
    const artifact = build.artifacts[0]!;
    const download = await callApi(["GET", `/v1/artifacts/${artifact.id}/download`], { raw: true });
    expect(download.code).toBe(0);
    const bytes = Buffer.concat(download.bytes);
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(artifact.sha256);
    const terminal = await callApi(["GET", `/v1/artifacts/${artifact.id}/download`]);
    expect(terminal.code).toBe(1);
    expect(terminal.stderr[0]).toContain("redirect stdout");
  }, 20_000);

  test("large output reaches a slow pipe reader before the CLI exits", async () => {
    const started = await t.json<{ id: string }>("POST", "/v1/processes", {
      projectId: "webapp",
      command: 'for i in $(seq 1 2000); do printf "line-%04d-%0150d\\n" $i 0; done',
    });
    await waitFor(async () => (await t.json<{ endedAt: string | null }>("GET", `/v1/processes/${started.body.id}`)).body.endedAt, 10_000);
    const cli = Bun.spawn([process.execPath, join(import.meta.dir, "..", "src", "index.ts"), "api", "GET", `/v1/processes/${started.body.id}/logs?tail=2000`], {
      env: { ...process.env, ...env },
      stdout: "pipe",
      stderr: "pipe",
    });
    await Bun.sleep(1_000);
    const [stdout, code] = await Promise.all([new Response(cli.stdout).text(), cli.exited]);
    expect(code).toBe(0);
    expect(stdout.length).toBeGreaterThan(256 * 1024);
    expect((JSON.parse(stdout) as unknown[]).length).toBe(2000);
  }, 20_000);

  test("rejects bad arguments before calling the API", async () => {
    const cases: Array<[string[], string | undefined, string]> = [
      [[], undefined, "Usage"],
      [["GET"], undefined, "Usage"],
      [["GET", "/v1/health", "{}", "extra"], undefined, "Usage"],
      [["PUT", "/v1/health"], undefined, "METHOD"],
      [["GET", "/health"], undefined, "/v1/"],
      [["GET", "http://example.com/v1/health"], undefined, "/v1/"],
      [["GET", "/v1/../ui/terminal"], undefined, "/v1/"],
      [["GET", "/v1/health", "{}"], undefined, "GET requests take no body"],
      [["POST", "/v1/events", "{not json"], undefined, "not valid JSON"],
      [["POST", "/v1/events", "-"], "", "stdin is empty"],
    ];
    for (const [args, stdin, message] of cases) {
      const result = await callApi(args, { stdin });
      expect(result.code).toBe(2);
      expect(result.stdout).toEqual([]);
      expect(result.stderr[0]).toContain(message);
    }
    const noToken = await callApi(["GET", "/v1/health"], { env: { TESSERACT_WORKSPACE: makeTempDir("cli-api"), TESSERACT_PORT: env.TESSERACT_PORT ?? "" } });
    expect(noToken.code).toBe(1);
    expect(noToken.stderr[0]).toContain("No API token");
  });
});
