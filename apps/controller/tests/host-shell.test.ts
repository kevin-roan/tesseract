import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { join } from "node:path";
import {
  HostHealthSchema,
  HostLockStatusSchema,
  HostSessionSchema,
  LIMITS,
  parsePairingLink,
  TerminalInfoSchema,
  TerminalListSchema,
  TerminalServerMessageSchema,
  TicketSchema,
  type HostSession,
  type TerminalInfo,
} from "@theone/protocol";
import { runCli, type Output } from "../src/cli/commands";
import { silentLogger } from "../src/core/logger";
import { HostConfigError, loadHostConfig, servedUrl, validateBind, type HostConfig } from "../src/host/config";
import { startHostShell, type HostShell } from "../src/host/server";
import { HostStateStore } from "../src/host/state";
import { hostShellEnv } from "../src/host/terminals";
import { makeTempDir, removeTempDirs, WsClient } from "./helpers";

const PIN = "482913";

let clock = Date.parse("2026-10-01T10:00:00.000Z");
let shell: HostShell | null = null;
let config: HostConfig;
let store: HostStateStore;
let base: string;
let token: string;

function hostConfig(): HostConfig {
  const dir = makeTempDir("host");
  return {
    ...loadHostConfig({ HOME: dir, THEONE_HOST_SHELL_DIR: join(dir, "state"), SHELL: "/bin/sh" }, { bind: "127.0.0.1", port: "0" }),
    shell: ["/bin/sh"],
  };
}

async function start(options: { pin?: boolean } = {}): Promise<void> {
  config = hostConfig();
  store = new HostStateStore(config.stateDir, config.stateFile);
  if (options.pin !== false) await store.setPin(PIN);
  shell = startHostShell(config, { logger: silentLogger, now: () => clock, stopGraceMs: 500 });
  base = shell.url.href.replace(/\/$/, "");
  token = store.ensureToken();
}

async function call(method: string, path: string, auth: string | null, body?: unknown): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function unlock(pin = PIN): Promise<HostSession> {
  const result = await call("POST", "/v1/host/unlock", token, { pin });
  if (result.status !== 200) throw new Error(`unlock failed ${result.status} ${JSON.stringify(result.body)}`);
  return HostSessionSchema.parse(result.body);
}

beforeEach(() => {
  clock = Date.parse("2026-10-01T10:00:00.000Z");
});

afterEach(async () => {
  await shell?.stop();
  shell = null;
});

afterAll(() => removeTempDirs());

describe("bind validation", () => {
  test("accepts loopback and Tailscale addresses only", () => {
    expect(validateBind("127.0.0.1")).toBe("127.0.0.1");
    expect(validateBind("100.64.0.1")).toBe("100.64.0.1");
    expect(validateBind("100.127.255.254")).toBe("100.127.255.254");
    for (const address of ["0.0.0.0", "192.168.1.10", "100.128.0.1", "10.0.0.1", "::", "localhost", "256.1.1.1"]) {
      expect(() => validateBind(address)).toThrow(HostConfigError);
    }
  });

  test("refuses empty and wildcard binds from the environment", () => {
    for (const bind of ["", " ", "::", "0.0.0.0"]) {
      expect(() => loadHostConfig({ THEONE_HOST_SHELL_BIND: bind, HOME: "/tmp" })).toThrow(HostConfigError);
    }
    expect(() => loadHostConfig({ THEONE_HOST_SHELL_PORT: "70000", THEONE_HOST_SHELL_BIND: "127.0.0.1" })).toThrow(HostConfigError);
  });

  test("defaults the state dir under XDG_CONFIG_HOME and the public url to the bind", () => {
    const loaded = loadHostConfig({ XDG_CONFIG_HOME: "/x/cfg", HOME: "/x", THEONE_HOST_SHELL_BIND: "100.100.1.2" });
    expect(loaded.stateFile).toBe("/x/cfg/theone/host-shell/state.json");
    expect(loaded.publicUrl).toBe("http://100.100.1.2:7701");
    expect(loadHostConfig({ HOME: "/x" }, {}, false).stateDir).toBe("/x/.config/theone/host-shell");
  });

  test("finds the tailscale serve HTTPS url that proxies to the daemon", () => {
    const web = (hostPort: string, proxy: string) => ({ [hostPort]: { Handlers: { "/": { Proxy: proxy } } } });
    const status = { Web: { ...web("box.tail1.ts.net:443", "http://100.85.0.1:7700"), ...web("box.tail1.ts.net:8443", "http://100.85.0.1:7701") } };
    expect(servedUrl(status, "100.85.0.1", 7701)).toBe("https://box.tail1.ts.net:8443");
    expect(servedUrl(status, "100.85.0.1", 7700)).toBe("https://box.tail1.ts.net");
    expect(servedUrl(status, "100.85.0.2", 7701)).toBeNull();
    expect(servedUrl({ Web: web("box.tail1.ts.net:443", "http://localhost:7701/") }, "127.0.0.1", 7701)).toBe("https://box.tail1.ts.net");
    expect(servedUrl({}, "100.85.0.1", 7701)).toBeNull();
  });

  test("children never see host shell variables", () => {
    expect(hostShellEnv({ THEONE_HOST_SHELL_DIR: "/s", PATH: "/bin" })).toEqual({ PATH: "/bin" });
  });
});

describe("state", () => {
  test("is written 0600 in a 0700 directory with an argon2id hash", async () => {
    await start();
    expect(statSync(config.stateDir).mode & 0o777).toBe(0o700);
    expect(statSync(config.stateFile).mode & 0o777).toBe(0o600);
    const state = store.read();
    expect(state.pinHash?.startsWith("$argon2id$")).toBe(true);
    expect(state.pinHash).not.toContain(PIN);
  });
});

describe("auth", () => {
  test("health is public and versioned", async () => {
    await start();
    const result = await call("GET", "/v1/health", null);
    expect(HostHealthSchema.parse(result.body)).toMatchObject({ ok: true, service: "host-shell", hostId: config.hostId });
  });

  test("lock status and unlock need the host token", async () => {
    await start();
    expect((await call("GET", "/v1/host/lock", null)).status).toBe(401);
    expect((await call("GET", "/v1/host/lock", "wrong")).status).toBe(401);
    expect((await call("POST", "/v1/host/unlock", "wrong", { pin: PIN })).status).toBe(401);
    const status = await call("GET", "/v1/host/lock", token);
    expect(HostLockStatusSchema.parse(status.body)).toEqual({ pinSet: true, attemptsLeft: LIMITS.hostPinMaxAttempts, lockedUntil: null });
  });

  test("terminal routes need a session, not the host token", async () => {
    await start();
    expect((await call("GET", "/v1/terminals", null)).status).toBe(401);
    expect((await call("GET", "/v1/terminals", token)).status).toBe(401);
    expect((await call("POST", "/v1/auth/ticket", token)).status).toBe(401);
    const { session } = await unlock();
    expect((await call("GET", "/v1/terminals", session)).status).toBe(200);
    expect((await call("GET", "/v1/host/lock", session)).status).toBe(401);
    expect((await call("POST", "/v1/host/unlock", session, { pin: PIN })).status).toBe(401);
  });

  test("rejects malformed PINs before counting them", async () => {
    await start();
    expect((await call("POST", "/v1/host/unlock", token, { pin: "12" })).status).toBe(400);
    expect(store.read().failures).toBe(0);
  });

  test("503 until a PIN is set", async () => {
    await start({ pin: false });
    const result = await call("POST", "/v1/host/unlock", token, { pin: PIN });
    expect(result.status).toBe(503);
    expect(result.body.error.message).toContain("host pin");
    expect((await call("GET", "/v1/host/lock", token)).body.pinSet).toBe(false);
  });

  test("wrong PINs count down, then lock out with doubling, persisted across restarts", async () => {
    await start();
    for (let left = LIMITS.hostPinMaxAttempts - 1; left > 0; left -= 1) {
      const wrong = await call("POST", "/v1/host/unlock", token, { pin: "000000" });
      expect(wrong.status).toBe(403);
      expect(wrong.body.error.message).toContain(`${left} attempt`);
    }
    const locked = await call("POST", "/v1/host/unlock", token, { pin: "000000" });
    expect(locked.body.error.message).toContain("Too many wrong PINs");
    const firstUntil = Date.parse(store.read().lockedUntil ?? "");
    expect(firstUntil - clock).toBe(LIMITS.hostLockoutBaseMs);

    const blocked = await call("POST", "/v1/host/unlock", token, { pin: PIN });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.message).toContain("Too many wrong PINs");
    expect((await call("GET", "/v1/host/lock", token)).body).toMatchObject({ attemptsLeft: 0, lockedUntil: new Date(firstUntil).toISOString() });

    await shell?.stop();
    shell = startHostShell(config, { logger: silentLogger, now: () => clock });
    base = shell.url.href.replace(/\/$/, "");
    expect((await call("POST", "/v1/host/unlock", token, { pin: PIN })).status).toBe(403);

    clock = firstUntil + 1;
    for (let i = 0; i < LIMITS.hostPinMaxAttempts; i += 1) await call("POST", "/v1/host/unlock", token, { pin: "000000" });
    expect(Date.parse(store.read().lockedUntil ?? "") - clock).toBe(LIMITS.hostLockoutBaseMs * 2);

    clock += LIMITS.hostLockoutMaxMs;
    await unlock();
    expect(store.read()).toMatchObject({ failures: 0, lockouts: 0, lockedUntil: null });
  });

  test("parallel guesses are serialized against the lockout", async () => {
    await start();
    const results = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/v1/host/unlock", token, { pin: "000000" })));
    expect(results.every((result) => result.status === 403)).toBe(true);
    expect(results.filter((result) => result.body.error.message.includes("Too many")).length).toBe(10 - LIMITS.hostPinMaxAttempts + 1);
    expect(store.read().lockouts).toBe(1);
  });

  test("sessions expire, and die on a new PIN, a rotated token or a lock", async () => {
    await start();
    const first = await unlock();
    clock += LIMITS.hostSessionTtlMs + 1;
    expect((await call("GET", "/v1/terminals", first.session)).status).toBe(401);

    const second = await unlock();
    await store.setPin("99887766", new Date(clock + 1));
    expect((await call("GET", "/v1/terminals", second.session)).status).toBe(401);

    const third = await unlock("99887766");
    token = store.rotateToken();
    expect((await call("GET", "/v1/terminals", third.session)).status).toBe(401);

    const fourth = await unlock("99887766");
    expect((await call("POST", "/v1/host/lock", token, { session: fourth.session })).status).toBe(204);
    expect((await call("GET", "/v1/terminals", fourth.session)).status).toBe(401);
  });
});

describe("terminals", () => {
  test("create, stream, survive session expiry, close", async () => {
    await start();
    const { session } = await unlock();
    const created = await call("POST", "/v1/terminals", session, { kind: "shell", cols: 80, rows: 24 });
    expect(created.status).toBe(201);
    const info: TerminalInfo = TerminalInfoSchema.parse(created.body);
    expect(info).toMatchObject({ kind: "shell", projectId: null, cwd: config.home, state: "running" });
    expect(TerminalListSchema.parse((await call("GET", "/v1/terminals", session)).body).map((entry) => entry.id)).toEqual([info.id]);

    const { ticket } = TicketSchema.parse((await call("POST", "/v1/auth/ticket", session)).body);
    const socket = await WsClient.connect(`${base.replace(/^http/, "ws")}/v1/terminals/${info.id}/stream?ticket=${ticket}`);
    socket.send({ type: "input", data: "echo host-$((40+2)) $THEONE_HOST_SHELL_DIR.\r" });
    const text = () =>
      socket.messages
        .map((message) => TerminalServerMessageSchema.parse(message))
        .map((message) => (message.type === "output" ? message.data : ""))
        .join("");
    await socket.waitFor(() => text().includes("host-42 ."), 8_000);

    clock += LIMITS.hostSessionTtlMs + 1;
    socket.send({ type: "input", data: "echo still-open\r" });
    await socket.waitFor(() => text().includes("still-open"), 8_000);
    expect((await call("POST", "/v1/auth/ticket", session)).status).toBe(401);

    const fresh = await unlock();
    const closed = await call("DELETE", `/v1/terminals/${info.id}`, fresh.session);
    expect(closed.status).toBe(200);
    expect(closed.body.state).toBe("exited");
    await socket.closed;
  });

  test("refuses claude terminals, projects, reused tickets and unknown ids", async () => {
    await start();
    const { session } = await unlock();
    expect((await call("POST", "/v1/terminals", session, { kind: "claude", cols: 80, rows: 24 })).status).toBe(400);
    expect((await call("POST", "/v1/terminals", session, { kind: "shell", projectId: "x", cols: 80, rows: 24 })).status).toBe(400);
    expect((await call("DELETE", "/v1/terminals/trm_missing", session)).status).toBe(404);
    const info = TerminalInfoSchema.parse((await call("POST", "/v1/terminals", session, { kind: "shell", cols: 80, rows: 24 })).body);
    const { ticket } = TicketSchema.parse((await call("POST", "/v1/auth/ticket", session)).body);
    const ws = `${base.replace(/^http/, "ws")}/v1/terminals/${info.id}/stream?ticket=${ticket}`;
    const socket = await WsClient.connect(ws);
    socket.close();
    await expect(WsClient.connect(ws)).rejects.toThrow();
    await call("DELETE", `/v1/terminals/${info.id}`, session);
  });

  test("serves the terminal page", async () => {
    await start();
    const response = await fetch(`${base}/ui/terminal`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<html");
  });
});

describe("host CLI", () => {
  const capture = () => {
    const out: string[] = [];
    const err: string[] = [];
    const output: Output = { out: (text) => out.push(text), err: (text) => err.push(text) };
    return { out, err, output };
  };

  test("pin (stdin and prompted), pair and token", async () => {
    const dir = makeTempDir("host-cli");
    const env = { HOME: dir, THEONE_HOST_SHELL_DIR: join(dir, "s"), THEONE_HOST_SHELL_BIND: "100.101.102.103" };
    const cli = new HostStateStore(join(dir, "s"), join(dir, "s", "state.json"));

    const bad = capture();
    expect(await runCli(["host", "pin", "--stdin"], { env, output: bad.output, readStdin: async () => "12ab\n" })).toBe(2);

    const prompts = ["123456", "123457"];
    const mismatch = capture();
    expect(await runCli(["host", "pin"], { env, output: mismatch.output, readSecret: async () => prompts.shift() ?? "" })).toBe(2);
    expect(mismatch.err.join("\n")).toContain("do not match");

    const paired = capture();
    expect(await runCli(["host", "pair", "--json"], { env, output: paired.output })).toBe(0);
    expect(paired.err.join("\n")).toContain("no PIN");
    const { link, pinSet } = JSON.parse(paired.out[0] ?? "{}") as { link: string; pinSet: boolean };
    expect(pinSet).toBe(false);
    const parsed = parsePairingLink(link, "host");
    expect(parsed.ok && parsed.value.url).toBe("http://100.101.102.103:7701");
    expect(parsed.ok && parsed.value.token).toBe(cli.read().token ?? "");

    const ok = capture();
    expect(await runCli(["host", "pin"], { env, output: ok.output, readSecret: async () => "24681357" })).toBe(0);
    expect(await Bun.password.verify("24681357", cli.read().pinHash ?? "")).toBe(true);
    const repaired = capture();
    expect(await runCli(["host", "pair", "--json"], { env, output: repaired.output })).toBe(0);
    expect((JSON.parse(repaired.out[0] ?? "{}") as { pinSet: boolean }).pinSet).toBe(true);

    const before = cli.read().token;
    const printed = capture();
    expect(await runCli(["host", "token"], { env, output: printed.output })).toBe(0);
    expect(printed.out).toEqual([before ?? ""]);
    expect(await runCli(["host", "token", "--rotate"], { env, output: capture().output })).toBe(0);
    expect(cli.read().token).not.toBe(before);

    const unknown = capture();
    expect(await runCli(["host", "nope"], { env, output: unknown.output })).toBe(2);
    expect(await runCli(["host", "serve", "--bind", "0.0.0.0"], { env, output: unknown.output })).toBe(2);
  });
});
