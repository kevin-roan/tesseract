import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  ApiError,
  isAuthError,
  TheOneClient,
  type ConnectionState,
  type TheOneError,
} from "@theone/client";
import { isFinalBuildState, PROTOCOL_VERSION, type LogLine, type ServerEvent } from "@theone/protocol";
import { installFakeClaude, makeTempDir, removeTempDirs, startTestController, waitFor, writeFiles, type TestController } from "./helpers";

let t: TestController;
let client: TheOneClient;

function git(dir: string, ...args: string[]): void {
  const result = Bun.spawnSync(["git", "-c", "user.name=Client", "-c", "user.email=client@example.com", ...args], { cwd: dir });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
}

beforeAll(async () => {
  const workspace = makeTempDir("client-integration");
  const site = join(workspace, "projects", "site");
  writeFiles(site, {
    "package.json": JSON.stringify({
      name: "site",
      version: "2.0.0",
      scripts: { build: "mkdir -p dist && echo '<p>ok</p>' > dist/index.html && echo built" },
    }),
    "bun.lock": "{}",
  });
  git(site, "init", "-q");
  git(site, "add", ".");
  git(site, "commit", "-q", "-m", "first");
  writeFiles(workspace, { ".agent/CURRENT_TASK.md": "# Current Task\n" });
  t = await startTestController({
    workspace,
    env: { THEONE_CLAUDE_BIN: installFakeClaude(makeTempDir("client-integration-bin")), THEONE_VNC_PASSWORD: "vnc-secret" },
    controller: { pingIntervalMs: 100 },
  });
  client = new TheOneClient({ baseUrl: t.baseUrl, token: t.controller.services.token });
});

afterAll(async () => {
  await t.stop();
  removeTempDirs();
});

describe("@theone/client against a live controller", () => {
  test("system endpoints", async () => {
    const health = await client.health();
    expect(health).toMatchObject({ ok: true, protocolVersion: PROTOCOL_VERSION, sandboxId: "test-sandbox" });
    expect((await client.createTicket()).ticket.length).toBeGreaterThan(20);
    const status = await client.status();
    expect(status.sandboxId).toBe("test-sandbox");
    expect(status.display.vnc.password).toBe("vnc-secret");
    expect((await client.context()).files.map((file) => file.name)).toContain("CURRENT_TASK.md");
    expect((await client.displayStatus()).webPath).toBe("/ui/vnc");
    const screenshot = await client.screenshot().catch((error: unknown) => error);
    expect(screenshot).toBeInstanceOf(ApiError);
    expect((screenshot as ApiError).code).toBe("unavailable");
    await client.publishStatus({ project: "site", status: "testing", message: "from the client" });
  });

  test("projects and git", async () => {
    expect((await client.listProjects()).map((project) => project.id)).toContain("site");
    const site = await client.getProject("site");
    expect(site.buildTargets).toContain("web");
    expect((await client.getProjectGit("site")).log[0]?.subject).toBe("first");
    const created = await client.createProject({ name: "Client Made" });
    expect(created.project.id).toBe("client-made");
    const missing = await client.getProject("ghost").catch((error: unknown) => error);
    expect(missing).toMatchObject({ status: 404, code: "not_found" });
  });

  test("processes with REST logs and the log stream", async () => {
    const started = await client.startProcess({ projectId: "site", command: "echo from-client; exit 5", name: "echo" });
    expect(started.id).toStartWith("prc_");
    const lines: LogLine[] = [];
    const exit = await new Promise<number | null>((resolve, reject) => {
      client.openProcessLogs(started.id, {
        onLine: (line) => lines.push(line),
        onExit: resolve,
        onError: reject,
      });
    });
    expect(exit).toBe(5);
    expect(lines.map((line) => line.text)).toContain("from-client");
    expect((await client.processLogs(started.id, { tail: 10 })).map((line) => line.text)).toContain("from-client");
    expect((await client.getProcess(started.id)).state).toBe("failed");
    expect((await client.listProcesses({ projectId: "site" })).map((process) => process.id)).toContain(started.id);

    const long = await client.startProcess({ projectId: "site", command: ["sleep", "30"] });
    expect((await client.stopProcess(long.id)).state).toBe("stopped");
  });

  test("terminals: create, stream, close", async () => {
    const terminal = await client.createTerminal({ kind: "shell", projectId: "site", cols: 80, rows: 24 });
    expect((await client.listTerminals()).map((item) => item.id)).toContain(terminal.id);
    let output = "";
    const code = await new Promise<number | null>((resolve, reject) => {
      const connection = client.openTerminal(terminal.id, {
        onOutput: (data) => (output += data),
        onExit: resolve,
        onError: reject,
      });
      connection.resize(100, 30);
      connection.send("stty size; exit 3\r");
    });
    expect(code).toBe(3);
    expect(output).toContain("30 100");
    const other = await client.createTerminal({ kind: "shell", cols: 80, rows: 24 });
    expect((await client.closeTerminal(other.id)).state).toBe("exited");
    const pageUrl = new URL(await client.terminalPageUrl(other.id));
    expect(pageUrl.pathname).toBe("/ui/terminal");
    expect(new URLSearchParams(pageUrl.hash.slice(1)).get("session")).toBe(other.id);
  });

  test("builds, the build log stream, artifacts and a ticketed download", async () => {
    const build = await client.startBuild({ projectId: "site", target: "web" });
    expect(build.profile).toBe("debug");
    const states: string[] = [];
    await new Promise<void>((resolve, reject) => {
      client.openBuildLogs(build.id, {
        onBuild: (update) => states.push(update.state),
        onExit: () => resolve(),
        onError: reject,
        onStateChange: (state: ConnectionState) => {
          if (state === "closed") resolve();
        },
      });
    });
    const done = await waitFor(async () => {
      const current = await client.getBuild(build.id);
      return isFinalBuildState(current.state) ? current : null;
    }, 15_000);
    expect(done.state).toBe("succeeded");
    expect(states).toContain("succeeded");
    expect((await client.buildLogs(build.id)).some((line) => line.text === "built")).toBe(true);
    expect((await client.listBuilds({ projectId: "site" })).map((item) => item.id)).toContain(build.id);
    expect((await client.cancelBuild(build.id)).state).toBe("succeeded");

    const artifacts = await client.listArtifacts({ projectId: "site" });
    const artifact = artifacts.find((item) => item.buildId === build.id);
    expect(artifact?.fileName).toBe("site-web-debug-2.0.0.zip");
    const url = await client.artifactDownloadUrl(artifact?.id ?? "");
    const download = await fetch(url);
    expect(download.status).toBe(200);
    expect((await download.arrayBuffer()).byteLength).toBe(artifact?.sizeBytes ?? -1);
    expect((await fetch(url)).status).toBe(401);
  });

  test("agent runs through REST and the run stream", async () => {
    const run = await client.startAgentRun({ projectId: "site", prompt: "hello from the client" });
    const kinds: string[] = [];
    const final = await new Promise<string>((resolve, reject) => {
      client.openAgentRun(run.id, {
        onEvent: (event) => kinds.push(event.kind),
        onRun: (update) => {
          if (update.state !== "running") resolve(update.state);
        },
        onError: reject,
      });
    });
    expect(final).toBe("succeeded");
    expect(kinds.length).toBeGreaterThan(0);
    const detail = await client.getAgentRun(run.id);
    expect(detail.events.length).toBe(kinds.length);
    expect((await client.listAgentRuns({ projectId: "site" })).map((item) => item.id)).toContain(run.id);
    expect((await client.cancelAgentRun(run.id)).state).toBe("succeeded");
  });

  test("the events stream says hello and carries updates", async () => {
    const events: ServerEvent[] = [];
    const connection = client.openEvents({ onEvent: (event) => events.push(event) });
    await waitFor(() => events.some((event) => event.type === "hello"));
    expect(events[0]).toEqual({ type: "hello", protocolVersion: PROTOCOL_VERSION, sandboxId: "test-sandbox" });
    await client.publishStatus({ project: null, status: "idle", message: "ping from test" });
    await waitFor(() => events.some((event) => event.type === "status" && event.event.message === "ping from test"));
    await waitFor(() => events.some((event) => event.type === "ping"));
    connection.close();
  });

  test("the VNC page URL carries a ticket and the password in its fragment", async () => {
    const url = new URL(await client.vncPageUrl());
    expect(url.pathname).toBe("/ui/vnc");
    expect(url.search).toBe("");
    const fragment = new URLSearchParams(url.hash.slice(1));
    expect(fragment.get("password")).toBe("vnc-secret");
    expect(fragment.get("ticket")?.length).toBeGreaterThan(20);
    expect((await fetch(`${url.origin}${url.pathname}`)).status).toBe(200);
  });

  test("a revoked token fails REST with an auth error and stops the events stream", async () => {
    const revoked = new TheOneClient({ baseUrl: t.baseUrl, token: "revoked-token" });
    expect((await revoked.health()).ok).toBe(true);
    const status = await revoked.status().catch((error: unknown) => error);
    expect(isAuthError(status)).toBe(true);
    expect(status).toMatchObject({ status: 401, code: "unauthorized" });

    const errors: TheOneError[] = [];
    const states: ConnectionState[] = [];
    revoked.openEvents(
      { onEvent: () => undefined, onError: (error) => errors.push(error), onStateChange: (state) => states.push(state) },
      { minDelayMs: 10, maxDelayMs: 20 },
    );
    await waitFor(() => states.includes("closed"));
    expect(errors.some(isAuthError)).toBe(true);
    expect(states).toEqual(["connecting", "closed"]);
  });
});
