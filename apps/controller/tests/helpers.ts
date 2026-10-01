import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TicketSchema } from "@theone/protocol";
import { loadConfig, type Config } from "../src/config";
import { silentLogger } from "../src/core/logger";
import { readProcStat } from "../src/core/proc";
import { startController, type Controller, type ControllerOptions } from "../src/server";

export const TEST_TOKEN = "test-token-0123456789abcdefghijklmnopqrstuvwxyz";
export const FAKE_CLAUDE = join(import.meta.dir, "fixtures", "fake-claude.sh");
const TEMP_ROOT = "/tmp";
const HERMETIC_SHELL = ["bash", "--noprofile", "--norc", "-i"];

const tempDirs: string[] = [];

export function makeTempDir(label = "tmp"): string {
  const dir = mkdtempSync(join(TEMP_ROOT, `theone-controller-test-${label}-`));
  tempDirs.push(dir);
  return dir;
}

export function removeTempDirs(): void {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
}

export function installFixture(dir: string, fixture: string, name: string): string {
  const target = join(dir, name);
  copyFileSync(join(import.meta.dir, "fixtures", fixture), target);
  chmodSync(target, 0o755);
  return target;
}

export function installFakeClaude(dir: string): string {
  return installFixture(dir, "fake-claude.sh", "fake-claude");
}

export async function waitFor<T>(check: () => T | Promise<T>, timeoutMs = 5_000, intervalMs = 25): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value as NonNullable<T>;
    } catch (error) {
      last = error;
    }
    await Bun.sleep(intervalMs);
  }
  throw new Error(`waitFor timed out after ${timeoutMs} ms${last ? `: ${String(last)}` : ""}`);
}

export function processGone(pid: number): boolean {
  const stat = readProcStat(pid);
  return stat === null || stat.state === "Z" || stat.state === "X";
}

export function labelledPid(text: string, label: string): number {
  const match = new RegExp(`${label}=(\\d+)`).exec(text);
  if (!match?.[1]) throw new Error(`No ${label}=<pid> in output`);
  return Number(match[1]);
}

export type TestEnv = Record<string, string | undefined>;

export type TestController = {
  controller: Controller;
  config: Config;
  workspace: string;
  baseUrl: string;
  wsBase: string;
  request: (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
  json: <T = unknown>(method: string, path: string, body?: unknown) => Promise<{ status: number; body: T }>;
  ticket: () => Promise<string>;
  socket: (path: string, protocols?: string | string[]) => Promise<WsClient>;
  stop: () => Promise<void>;
};

export async function startTestController(
  options: { env?: TestEnv; controller?: ControllerOptions; workspace?: string; config?: (config: Config) => void } = {},
): Promise<TestController> {
  const workspace = options.workspace ?? makeTempDir("ws");
  const config = loadConfig({
    THEONE_WORKSPACE: workspace,
    THEONE_HOST: "127.0.0.1",
    THEONE_PORT: "0",
    THEONE_TOKEN: TEST_TOKEN,
    THEONE_DISPLAY: ":987",
    THEONE_VNC_HOST: "127.0.0.1",
    THEONE_VNC_PORT: "1",
    THEONE_CHROMIUM_DEBUG_PORT: "1",
    THEONE_CLAUDE_BIN: "/nonexistent/claude",
    THEONE_TAILSCALE_SOCKET: "/nonexistent/tailscaled.sock",
    CLAUDE_CONFIG_DIR: join(workspace, ".claude"),
    THEONE_SANDBOX_ID: "test-sandbox",
    THEONE_PUSH_URL: "off",
    THEONE_WHISPER_MODELS_DIR: join(workspace, ".whisper-models"),
    THEONE_LOG_LEVEL: "error",
    ...options.env,
  });
  config.shell = HERMETIC_SHELL;
  options.config?.(config);
  const controller = startController(config, {
    logger: silentLogger,
    stopGraceMs: 1_000,
    runtimeDebounceMs: 50,
    toolProbes: [{ name: "git", bin: "git", args: ["--version"] }],
    ...options.controller,
  });
  const baseUrl = controller.url.origin;
  const wsBase = baseUrl.replace(/^http/, "ws");
  const token = controller.services.token;

  const request = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });

  const json = async <T>(method: string, path: string, body?: unknown) => {
    const response = await request(method, path, body);
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
  };

  const ticket = async () => {
    const { body } = await json("POST", "/v1/auth/ticket");
    return TicketSchema.parse(body).ticket;
  };

  const socket = async (path: string, protocols?: string | string[]) =>
    WsClient.connect(`${wsBase}${path}${path.includes("?") ? "&" : "?"}ticket=${encodeURIComponent(await ticket())}`, protocols);

  return { controller, config, workspace, baseUrl, wsBase, request, json, ticket, socket, stop: () => controller.stop() };
}

type Waiter = { predicate: (message: unknown) => boolean; resolve: (message: unknown) => void };

export class WsClient {
  readonly messages: unknown[] = [];
  readonly closed: Promise<{ code: number; reason: string }>;
  private readonly waiters = new Set<Waiter>();

  private constructor(readonly ws: WebSocket) {
    ws.binaryType = "arraybuffer";
    this.closed = new Promise((resolve) => ws.addEventListener("close", (event) => resolve({ code: event.code, reason: event.reason })));
    ws.addEventListener("message", (event) => {
      const message = typeof event.data === "string" ? (JSON.parse(event.data) as unknown) : new Uint8Array(event.data as ArrayBuffer);
      this.messages.push(message);
      for (const waiter of this.waiters) {
        if (waiter.predicate(message)) {
          this.waiters.delete(waiter);
          waiter.resolve(message);
        }
      }
    });
  }

  static connect(url: string, protocols?: string | string[]): Promise<WsClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, protocols);
      const client = new WsClient(ws);
      ws.addEventListener("open", () => resolve(client), { once: true });
      ws.addEventListener("error", () => reject(new Error(`WebSocket to ${url.replace(/ticket=[^&]+/, "ticket=…")} failed`)), { once: true });
    });
  }

  waitFor<T = unknown>(predicate: (message: T) => boolean, timeoutMs = 5_000): Promise<T> {
    const existing = this.messages.find((message) => predicate(message as T));
    if (existing !== undefined) return Promise.resolve(existing as T);
    return new Promise<T>((resolve, reject) => {
      const waiter: Waiter = { predicate: (message) => predicate(message as T), resolve: (message) => resolve(message as T) };
      this.waiters.add(waiter);
      setTimeout(() => {
        if (this.waiters.delete(waiter)) reject(new Error(`No matching WebSocket message within ${timeoutMs} ms`));
      }, timeoutMs);
    });
  }

  send(message: unknown): void {
    this.ws.send(typeof message === "string" || message instanceof Uint8Array ? message : JSON.stringify(message));
  }

  close(): void {
    this.ws.close();
  }
}

export async function upgradeStatus(url: string, protocol?: string): Promise<{ status: number; body: string }> {
  const response = await fetch(url.replace(/^ws/, "http"), {
    headers: {
      Connection: "Upgrade",
      Upgrade: "websocket",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Key": btoa("0123456789abcdef"),
      ...(protocol ? { "Sec-WebSocket-Protocol": protocol } : {}),
    },
  });
  return { status: response.status, body: await response.text() };
}

/**
 * A WebSocket client that completes the upgrade and then stops reading, to exercise server
 * backpressure. A paused socket cannot see the server's close until `resume` is called.
 */
export async function openStalledSocket(
  t: TestController,
  path: string,
): Promise<{ closed: Promise<void>; resume: () => void; end: () => void }> {
  const url = new URL(`${t.baseUrl}${path}`);
  url.searchParams.set("ticket", await t.ticket());
  let upgraded: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    upgraded = resolve;
  });
  let markClosed: () => void = () => {};
  const closed = new Promise<void>((resolve) => {
    markClosed = resolve;
  });
  const socket = await Bun.connect({
    hostname: url.hostname,
    port: Number(url.port),
    socket: {
      data: (current, chunk) => {
        if (new TextDecoder().decode(chunk).startsWith("HTTP/1.1 101")) {
          current.pause();
          upgraded();
        }
      },
      close: () => markClosed(),
    },
  });
  socket.write(
    [
      `GET ${url.pathname}${url.search} HTTP/1.1`,
      `Host: ${url.host}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      "Sec-WebSocket-Version: 13",
      `Sec-WebSocket-Key: ${btoa("0123456789abcdef")}`,
      "",
      "",
    ].join("\r\n"),
  );
  await ready;
  return { closed, resume: () => socket.resume(), end: () => socket.end() };
}
