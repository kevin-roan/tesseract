import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOST_DOCKER_SPEC_HEADER, HostDockerMessageSchema, HostSessionSchema, type HostDockerMessage } from "@tesseract/protocol";
import { silentLogger } from "../src/core/logger";
import { loadHostConfig, type HostConfig } from "../src/host/config";
import { startHostShell, type HostShell } from "../src/host/server";
import { HostStateStore } from "../src/host/state";
import { containerShellArgv } from "../src/host/terminals";
import { makeTempDir, removeTempDirs } from "./helpers";

const PIN = "482913";
const FAKE_DOCKER = `#!/bin/sh
echo "args:$*"
echo "token:$TUNNEL_TOKEN"
bytes=$(cat | wc -c | tr -d ' ')
echo "stdin:$bytes" >&2
[ "$1" = "sleep" ] && sleep 5
exit 3
`;

let shell: HostShell | null = null;
let base = "";
let token = "";

async function start(): Promise<void> {
  const dir = makeTempDir("host-docker");
  const bin = join(dir, "docker");
  writeFileSync(bin, FAKE_DOCKER);
  chmodSync(bin, 0o755);
  const config: HostConfig = {
    ...loadHostConfig({ HOME: dir, TESSERACT_HOST_SHELL_DIR: join(dir, "state"), SHELL: "/bin/sh" }, { bind: "127.0.0.1", port: "0" }),
    shell: ["/bin/sh"],
  };
  const store = new HostStateStore(config.stateDir, config.stateFile);
  await store.setPin(PIN);
  shell = startHostShell(config, { logger: silentLogger, stopGraceMs: 500, workspace: () => null, docker: { bin } });
  base = shell.url.href.replace(/\/$/, "");
  token = store.ensureToken();
}

async function session(): Promise<string> {
  const response = await fetch(`${base}/v1/host/unlock`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pin: PIN }),
  });
  return HostSessionSchema.parse(await response.json()).session;
}

async function docker(auth: string, spec: unknown, body?: string): Promise<{ status: number; messages: HostDockerMessage[]; text: string }> {
  const response = await fetch(`${base}/v1/host/docker`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth}`, [HOST_DOCKER_SPEC_HEADER]: JSON.stringify(spec) },
    body,
  });
  const text = await response.text();
  if (response.status !== 200) return { status: response.status, messages: [], text };
  const messages = text
    .split("\n")
    .filter(Boolean)
    .map((line) => HostDockerMessageSchema.parse(JSON.parse(line)));
  return { status: response.status, messages, text };
}

afterEach(async () => {
  await shell?.stop();
  shell = null;
});

afterAll(() => removeTempDirs());

describe("host docker", () => {
  test("needs a session, not the host token", async () => {
    await start();
    expect((await docker(token, { args: ["ps"] })).status).toBe(401);
  });

  test("streams stdout and stderr, pipes stdin and passes extra env, then reports the exit code", async () => {
    await start();
    const result = await docker(await session(), { args: ["exec", "-i", "box"], env: { TUNNEL_TOKEN: "t0k" } }, "hello");
    expect(result.status).toBe(200);
    expect(result.messages).toContainEqual({ type: "stdout", data: "args:exec -i box" });
    expect(result.messages).toContainEqual({ type: "stdout", data: "token:t0k" });
    expect(result.messages).toContainEqual({ type: "stderr", data: "stdin:5" });
    expect(result.messages.at(-1)).toEqual({ type: "exit", code: 3, timedOut: false });
  });

  test("kills a command past its timeout", async () => {
    await start();
    const result = await docker(await session(), { args: ["sleep"], timeoutMs: 200 });
    expect(result.messages.at(-1)).toMatchObject({ type: "exit", timedOut: true });
  });

  test("rejects a missing or invalid spec and unsafe env names", async () => {
    await start();
    const auth = await session();
    const missing = await fetch(`${base}/v1/host/docker`, { method: "POST", headers: { Authorization: `Bearer ${auth}` } });
    expect(missing.status).toBe(400);
    expect((await docker(auth, { args: [] })).status).toBe(400);
    expect((await docker(auth, { args: ["ps"], env: { "LD_PRELOAD=x;": "1" } })).status).toBe(400);
  });
});

describe("container terminals", () => {
  test("exec a root login shell in the server container", () => {
    expect(containerShellArgv("api", "/usr/bin/docker")).toEqual([
      "/usr/bin/docker",
      "exec",
      "-it",
      "-u",
      "root",
      "-w",
      "/root",
      "-e",
      "TERM=xterm-256color",
      "-e",
      "COLORTERM=truecolor",
      "-e",
      "LANG=C.UTF-8",
      "tesseract-ct-api",
      "/bin/bash",
      "-l",
    ]);
  });

  test("refuse a folder or a claude kind next to a container", async () => {
    await start();
    const auth = await session();
    const create = (body: unknown) =>
      fetch(`${base}/v1/terminals`, { method: "POST", headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect((await create({ kind: "claude", container: "api", cwd: "/tmp", cols: 80, rows: 24 })).status).toBe(400);
    expect((await create({ kind: "shell", container: "api", cwd: "/tmp", cols: 80, rows: 24 })).status).toBe(400);
    expect((await create({ kind: "shell", container: "Bad_Name", cols: 80, rows: 24 })).status).toBe(400);
  });
});
