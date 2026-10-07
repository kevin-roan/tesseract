import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import type { FetchLike, HttpRequestInit } from "@theone/client";
import { DEFAULT_ANDROID_STREAM, type HostAndroidStatus } from "@theone/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostShellState } from "../../shared/contracts/hostShell";
import type { CommandOptions, CommandResult } from "../process";
import { isSessionRequired } from "./model";
import { HostShellService, type HostShellDeps } from "./service";

const URL_BASE = "http://127.0.0.1:7799";
const sampleHostAndroidStatus: HostAndroidStatus = {
  available: true,
  reason: null,
  sdkRoot: "/home/me/.local/share/theone/android-sdk",
  isolation: "netns",
  avds: ["Pixel_9"],
  scrcpy: true,
  ffmpeg: true,
  emulator: {
    state: "running",
    avd: "Pixel_9",
    serial: "127.0.0.1:41555",
    managed: true,
    isolated: true,
    width: 1080,
    height: 2400,
    startedAt: "2026-01-01T00:00:00.000Z",
    error: null,
  },
  link: { configured: true, sandboxUrl: "http://100.64.0.2:7700", connected: true, lastError: null },
  stream: { ...DEFAULT_ANDROID_STREAM },
  devices: [],
};
const LINK = `theone://host?url=${encodeURIComponent(URL_BASE)}&token=host-token&name=box`;
const PAIR_OUTPUT = (pinSet = true) => `${JSON.stringify({ link: LINK, url: URL_BASE, name: "box", pinSet })}\n`;

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  signals: string[] = [];

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.signals.push(signal);
    return true;
  }

  exit(code: number | null, signal: NodeJS.Signals | null = null): void {
    this.exitCode = code;
    this.signalCode = signal;
    this.stdout.end();
    this.stderr.end();
    setImmediate(() => this.emit("close", code, signal));
  }

  line(text: string, stream: "stdout" | "stderr" = "stdout"): void {
    this[stream].write(`${text}\n`);
  }
}

interface Harness {
  service: HostShellService;
  states: HostShellState[];
  runs: { args: readonly string[]; input?: string; env?: NodeJS.ProcessEnv }[];
  children: FakeChild[];
  spawned: { file: string; args: readonly string[] }[];
  requests: { url: string; init: HttpRequestInit }[];
}

type Route = (url: string, init: HttpRequestInit) => { status: number; body: unknown } | Error;

function response(status: number, body: unknown) {
  const text = body === undefined ? "" : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: () => null },
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
  };
}

function harness(options: {
  pair?: () => CommandResult;
  route?: Route;
  autostart?: boolean;
  deps?: Partial<HostShellDeps>;
} = {}): Harness {
  const states: HostShellState[] = [];
  const runs: Harness["runs"] = [];
  const children: FakeChild[] = [];
  const spawned: Harness["spawned"] = [];
  const requests: Harness["requests"] = [];
  const ok = (stdout = ""): CommandResult => ({ code: 0, stdout, stderr: "", timedOut: false });
  const run = async (_file: string, args: readonly string[], commandOptions: CommandOptions): Promise<CommandResult> => {
    runs.push({ args, input: commandOptions.input, env: commandOptions.env });
    if (args.includes("pair")) return options.pair?.() ?? ok(PAIR_OUTPUT());
    return ok("done\n");
  };
  const fetch: FetchLike = async (url, init) => {
    requests.push({ url, init });
    const result = options.route?.(url, init) ?? { status: 404, body: { error: { code: "not_found", message: "nope" } } };
    if (result instanceof Error) throw result;
    return response(result.status, result.body);
  };
  const service = new HostShellService({
    command: () => ["/bin/ctl", "--x"],
    env: () => ({ PATH: "/nowhere", THEONE_HOST_SHELL_PORT: "7799" }),
    platform: "linux",
    autostart: options.autostart,
    onChange: (state) => states.push(state),
    run,
    fetch,
    spawn: (file, args) => {
      spawned.push({ file, args });
      const child = new FakeChild();
      children.push(child);
      return child as unknown as ChildProcess;
    },
    ...options.deps,
  });
  return { service, states, runs, children, spawned, requests };
}

const healthRoute: Route = (url) =>
  url.endsWith("/v1/health") ? { status: 200, body: { ok: true, service: "host-shell", version: "1", protocolVersion: 1, hostId: "box" } } : { status: 404, body: {} };

async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await new Promise((resolve) => setImmediate(resolve));
}

describe("HostShellService.refresh", () => {
  it("probes with host pair --json and stays stopped when nothing answers", async () => {
    const { service, runs } = harness();
    const state = await service.refresh();
    expect(runs[0]?.args).toEqual(["--x", "host", "pair", "--json"]);
    expect(state).toMatchObject({ status: "stopped", error: null, pairing: { url: URL_BASE, pinSet: true, name: "box" } });
  });

  it("detects a daemon running outside the app", async () => {
    const { service } = harness({ route: healthRoute });
    expect((await service.refresh()).status).toBe("external");
  });

  it("marks a failed probe and keeps the daemon's message", async () => {
    const { service } = harness({
      pair: () => ({ code: 2, stdout: "", stderr: "error: tailscale is not installed; install it on the host or pass --bind <ipv4>\n", timedOut: false }),
    });
    expect(await service.refresh()).toMatchObject({
      status: "failed",
      error: "tailscale is not installed; install it on the host or pass --bind <ipv4>",
    });
  });

  it("reports a CLI timeout", async () => {
    const { service } = harness({ pair: () => ({ code: null, stdout: "", stderr: "", timedOut: true }) });
    expect((await service.refresh()).error).toBe("The controller did not answer in time");
  });

  it("runs at most one probe at a time and queues one more", async () => {
    const { service, runs } = harness();
    await Promise.all([service.refresh(), service.refresh(), service.refresh(), service.refresh()]);
    expect(runs.filter((run) => run.args.includes("pair"))).toHaveLength(2);
  });

  it("goes back to stopped when an external daemon disappears", async () => {
    let up = true;
    const { service } = harness({ route: (url, init) => (up ? healthRoute(url, init) : new Error("ECONNREFUSED")) });
    expect((await service.refresh()).status).toBe("external");
    up = false;
    expect((await service.refresh()).status).toBe("stopped");
  });
});

describe("HostShellService daemon lifecycle", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("starts, becomes running on the listening line, and stops", async () => {
    const { service, children, spawned, states } = harness();
    expect((await service.start()).status).toBe("starting");
    expect(spawned[0]?.args).toEqual(["--x", "host", "serve"]);
    const child = children[0] as FakeChild;
    child.line("2026-01-01T00:00:00.000Z INFO  [host-shell] host shell listening url=http://127.0.0.1:7799 host=box");
    await flush();
    expect(service.state().status).toBe("running");
    expect(service.state().log.at(-1)).toContain("host shell listening");
    expect(service.hasChild()).toBe(true);
    expect((await service.stop()).status).toBe("stopping");
    expect(child.signals).toEqual(["SIGTERM"]);
    child.exit(null, "SIGTERM");
    await flush();
    expect(service.state()).toMatchObject({ status: "stopped", error: null });
    expect(states.some((state) => state.status === "running")).toBe(true);
  });

  it("restarts the owned daemon only when its Android env changes", async () => {
    const env: Record<string, string | undefined> = { PATH: "/nowhere" };
    const { service, children, spawned } = harness({ deps: { env: () => ({ ...env }) } });
    await service.start();
    const first = children[0] as FakeChild;
    first.line("2026-01-01T00:00:00.000Z INFO  [host-shell] host shell listening url=http://127.0.0.1:7799 host=box");
    await flush();
    await service.restartIfEnvChanged(["THEONE_ANDROID_SDK_ROOT"]);
    expect(spawned).toHaveLength(1);
    env.THEONE_ANDROID_SDK_ROOT = "/sdk";
    const restarting = service.restartIfEnvChanged(["THEONE_ANDROID_SDK_ROOT"]);
    await flush();
    expect(first.signals).toEqual(["SIGTERM"]);
    first.exit(null, "SIGTERM");
    expect((await restarting).status).toBe("starting");
    expect(spawned).toHaveLength(2);
  });

  it("does not spawn when a daemon already answers", async () => {
    const { service, spawned } = harness({ route: healthRoute });
    expect((await service.start()).status).toBe("external");
    expect(spawned).toHaveLength(0);
  });

  it("fails with the daemon's last error line on a non-zero exit", async () => {
    const { service, children } = harness();
    await service.start();
    const child = children[0] as FakeChild;
    child.line("starting", "stdout");
    child.line("error: Port 7799 is already in use", "stderr");
    await flush();
    child.exit(1);
    await flush();
    expect(service.state()).toMatchObject({ status: "failed", error: "Port 7799 is already in use" });
  });

  it("reports spawn errors", async () => {
    const { service } = harness({
      deps: {
        spawn: () => {
          throw new Error("spawn /bin/ctl ENOENT");
        },
      },
    });
    expect(await service.start()).toMatchObject({ status: "failed", error: "spawn /bin/ctl ENOENT" });
  });

  it("ignores a stale child's exit", async () => {
    const { service, children } = harness();
    await service.start();
    const first = children[0] as FakeChild;
    await service.stop();
    first.exit(0);
    await flush();
    await service.start();
    first.emit("close", 1, null);
    await flush();
    expect(service.state().status).toBe("starting");
  });

  it("kills the daemon after the grace period", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { service, children } = harness();
    await service.start();
    const child = children[0] as FakeChild;
    await service.stop();
    vi.advanceTimersByTime(5_000);
    expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]);
    vi.useRealTimers();
  });

  it("shuts down on quit, waiting for the exit", async () => {
    const { service, children } = harness();
    await service.start();
    const child = children[0] as FakeChild;
    const done = service.shutdown();
    expect(service.shutdown()).toBe(done);
    child.exit(0);
    await done;
    expect(child.signals).toEqual(["SIGTERM"]);
  });

  it("starts at init when autostart is on, probes otherwise", async () => {
    const auto = harness({ autostart: true });
    expect((await auto.service.init()).status).toBe("starting");
    const manual = harness();
    expect((await manual.service.init()).status).toBe("stopped");
    expect(manual.spawned).toHaveLength(0);
  });
});

describe("HostShellService PIN and token", () => {
  it("sends the PIN on stdin, never in argv", async () => {
    const { service, runs } = harness();
    await service.setPin("123456");
    const pin = runs.find((run) => run.args.includes("pin"));
    expect(pin?.args).toEqual(["--x", "host", "pin", "--stdin"]);
    expect(pin?.input).toBe("123456\n");
    expect(runs.at(-1)?.args).toContain("pair");
  });

  it("rejects malformed PINs", async () => {
    const { service, runs } = harness();
    await expect(service.setPin("12ab")).rejects.toMatchObject({ code: "invalid_argument", message: "The PIN must be 6 to 12 digits" });
    expect(runs).toHaveLength(0);
  });

  it("rotates the token then re-probes", async () => {
    const { service, runs } = harness();
    await service.rotateToken();
    expect(runs.map((run) => run.args.slice(2).join(" "))).toEqual(["token --rotate", "pair --json"]);
  });

  it("persists autostart", async () => {
    const saved: boolean[] = [];
    const { service } = harness({ deps: { saveAutostart: async (enabled) => void saved.push(enabled) } });
    expect((await service.setAutostart(true)).autostart).toBe(true);
    expect(saved).toEqual([true]);
  });
});

describe("HostShellService Android session", () => {
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const route: Route = (url, init) => {
    if (url.endsWith("/v1/health")) return healthRoute(url, init);
    if (url.endsWith("/v1/host/unlock")) {
      if (init.headers.Authorization !== "Bearer host-token") return { status: 401, body: { error: { code: "unauthorized", message: "bad token" } } };
      const pin = (JSON.parse(init.body ?? "{}") as { pin?: string }).pin;
      return pin === "123456"
        ? { status: 200, body: { session: "pin-session", expiresAt } }
        : { status: 403, body: { error: { code: "forbidden", message: "Wrong PIN; 4 attempts left" } } };
    }
    if (url.endsWith("/v1/android")) {
      return init.headers.Authorization === "Bearer pin-session"
        ? { status: 200, body: sampleHostAndroidStatus }
        : { status: 401, body: { error: { code: "unauthorized", message: "expired" } } };
    }
    if (url.endsWith("/v1/android/emulator")) return { status: 200, body: sampleHostAndroidStatus.emulator };
    if (url.endsWith("/v1/android/link")) return { status: 200, body: sampleHostAndroidStatus.link };
    if (url.endsWith("/v1/host/lock")) return { status: 204, body: undefined };
    return { status: 404, body: {} };
  };

  it("requires a PIN session for Android calls", async () => {
    const { service } = harness({ route });
    await service.refresh();
    const error = await service.androidStatus().catch((caught: unknown) => caught);
    expect(isSessionRequired(error)).toBe(true);
  });

  it("unlocks with the host token, then calls the Android API with the session", async () => {
    const { service, requests } = harness({ route });
    await service.refresh();
    const state = await service.unlock("123456");
    expect(state.sessionExpiresAt).toBe(Date.parse(expiresAt));
    expect(JSON.stringify(state)).not.toContain("pin-session");
    expect(JSON.stringify(state)).not.toContain("host-token\"");
    expect(await service.androidStatus()).toEqual(sampleHostAndroidStatus);
    await service.startEmulator("Pixel_9");
    const start = requests.find((request) => request.url.endsWith("/v1/android/emulator"));
    expect(JSON.parse(start?.init.body ?? "{}")).toEqual({ avd: "Pixel_9" });
    expect(await service.linkSandbox("http://100.64.0.2:7700", "sandbox-token")).toEqual(sampleHostAndroidStatus.link);
    await service.stopEmulator();
    expect(requests.some((request) => request.init.method === "DELETE")).toBe(true);
  });

  it("shows the server's wrong-PIN message", async () => {
    const { service } = harness({ route });
    await service.refresh();
    await expect(service.unlock("654321")).rejects.toMatchObject({ code: "forbidden", message: "Wrong PIN; 4 attempts left" });
    expect(service.state().sessionExpiresAt).toBeNull();
  });

  it("forgets the session on an auth error", async () => {
    let valid = true;
    const { service } = harness({
      route: (url, init) =>
        url.endsWith("/v1/android") && !valid ? { status: 401, body: { error: { code: "unauthorized", message: "expired" } } } : route(url, init),
    });
    await service.refresh();
    await service.unlock("123456");
    valid = false;
    const error = await service.androidStatus().catch((caught: unknown) => caught);
    expect(isSessionRequired(error)).toBe(true);
    expect(service.state().sessionExpiresAt).toBeNull();
  });

  it("drops a session close to its expiry", async () => {
    const { service } = harness({ route, deps: { now: () => Date.parse(expiresAt) - 10_000 } });
    await service.refresh();
    await service.unlock("123456");
    expect(isSessionRequired(await service.androidStatus().catch((caught: unknown) => caught))).toBe(true);
  });

  it("says the host is not answering on network errors", async () => {
    let down = false;
    const { service } = harness({ route: (url, init) => (down && url.endsWith("/v1/android") ? new TypeError("fetch failed") : route(url, init)) });
    await service.refresh();
    await service.unlock("123456");
    down = true;
    await expect(service.androidStatus()).rejects.toMatchObject({ message: `The host shell is not answering at ${URL_BASE}` });
  });

  it("refuses Android calls while the host shell is not serving", async () => {
    const { service } = harness();
    await service.refresh();
    await expect(service.androidStatus()).rejects.toMatchObject({ message: "The host shell is not running" });
    await expect(service.unlock("123456")).rejects.toMatchObject({ message: "The host shell is not running" });
  });

  it("locks the session", async () => {
    const { service, requests } = harness({ route });
    await service.refresh();
    await service.unlock("123456");
    expect((await service.lock()).sessionExpiresAt).toBeNull();
    const lock = requests.find((request) => request.url.endsWith("/v1/host/lock"));
    expect(JSON.parse(lock?.init.body ?? "{}")).toEqual({ session: "pin-session" });
  });
});

afterEach(() => {
  vi.useRealTimers();
});
