import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import type { TailnetStatus } from "@tesseract/protocol";
import { afterEach, describe, expect, it } from "vitest";
import {
  backoffMs,
  hostTailnetEnabled,
  hostTailnetEnv,
  hostTailnetHostname,
  nodeDnsName,
  parseStatusLine,
  tailnetBinaryPath,
  tailnetUpArgs,
} from "./model";
import { HostTailnetSupervisor, type SupervisorState } from "./supervisor";

const KEY = { authKey: "hskey-1", loginServer: "https://net.example", magicDnsSuffix: "tesseract.internal", hostname: "pc-host", tags: [], expiresAt: "2026-11-08T11:00:00.000Z" };

function status(state: TailnetStatus["state"], extra: Partial<TailnetStatus> = {}): TailnetStatus {
  return { state, hostName: "pc-host", dnsName: null, ips: [], magicDnsSuffix: null, loginServer: null, error: null, peers: [], ...extra };
}

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  signals: string[] = [];
  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.signals.push(signal);
    this.exit(null, signal);
    return true;
  }
  exit(code: number | null, signal: NodeJS.Signals | null = null): void {
    if (this.exitCode !== null || this.signalCode !== null) return;
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("close", code, signal);
  }
  print(value: TailnetStatus | string): void {
    this.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value)}\n`);
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = "";
});

function setup(options: { keyError?: Error } = {}) {
  dir = mkdtempSync(join(tmpdir(), "tailnet-"));
  const children: FakeChild[] = [];
  const spawned: string[][] = [];
  const keys: string[] = [];
  const retries: { ms: number; run(): void }[] = [];
  const states: SupervisorState[] = [];
  const stateDir = join(dir, "tailnet");
  const supervisor = new HostTailnetSupervisor({
    binary: () => "/bin/tesseract-tailnet",
    exists: () => true,
    stateDir,
    metaFile: join(dir, "tailnet.json"),
    deviceKey: async (hostname) => {
      keys.push(hostname);
      if (options.keyError) throw options.keyError;
      return KEY;
    },
    onChange: (state) => states.push(state),
    spawn: (_file, args) => {
      spawned.push([...args]);
      const child = new FakeChild();
      children.push(child);
      return child as unknown as ChildProcess;
    },
    schedule: (run, ms) => {
      retries.push({ ms, run });
      return () => undefined;
    },
  });
  const joinState = () => {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, "tailscaled.state"), "{}");
  };
  return { supervisor, children, spawned, keys, retries, states, joinState };
}

describe("host tailnet model", () => {
  it("finds the bundled binary and the checkout build", () => {
    expect(tailnetBinaryPath({ packaged: true, resourcesPath: "/opt/T/resources", repoRoot: null, platform: "linux", arch: "x64" })).toBe("/opt/T/resources/bin/tesseract-tailnet");
    expect(tailnetBinaryPath({ packaged: false, resourcesPath: null, repoRoot: "/repo", platform: "darwin", arch: "arm64" })).toBe(
      "/repo/apps/electron/resources/bin/mac-arm64/tesseract-tailnet",
    );
    expect(tailnetBinaryPath({ packaged: true, resourcesPath: "C:\\T", repoRoot: null, platform: "win32", arch: "x64" })).toMatch(/tesseract-tailnet\.exe$/);
    expect(tailnetBinaryPath({ packaged: false, resourcesPath: null, repoRoot: null, platform: "linux", arch: "x64" })).toBeNull();
  });

  it("derives a valid <computer>-host name", () => {
    expect(hostTailnetHostname("Kevins-MacBook-Pro.local")).toBe("kevins-macbook-pro-host");
    expect(hostTailnetHostname("DESKTOP_42")).toBe("desktop-42-host");
    expect(hostTailnetHostname("---")).toBe("tesseract-host");
    expect(hostTailnetHostname("a".repeat(80))).toHaveLength(63);
  });

  it("builds the up command with both serves and the key only when given", () => {
    expect(tailnetUpArgs({ stateDir: "/s", loginServer: "https://net.example", authKey: "k", hostname: "pc-host" })).toEqual([
      "up", "--state-dir", "/s", "--login-server", "https://net.example", "--auth-key", "k", "--hostname", "pc-host",
      "--serve", "7701=127.0.0.1:7701", "--serve", "7702=127.0.0.1:7702",
    ]);
    expect(tailnetUpArgs({ stateDir: "/s", loginServer: "u", authKey: null, hostname: "h" })).not.toContain("--auth-key");
  });

  it("parses status lines and ignores noise", () => {
    expect(parseStatusLine(JSON.stringify(status("running")))).toEqual(status("running"));
    expect(parseStatusLine("2026/11/08 logtail started")).toBeNull();
    expect(parseStatusLine('{"state":"weird"}')).toBeNull();
  });

  it("resolves the mode, backoff, names and env", () => {
    expect(hostTailnetEnabled("auto", true, false)).toBe(true);
    expect(hostTailnetEnabled("auto", true, true)).toBe(false);
    expect(hostTailnetEnabled("on", true, true)).toBe(true);
    expect(hostTailnetEnabled("on", false, false)).toBe(false);
    expect(hostTailnetEnabled("off", true, false)).toBe(false);
    expect([0, 1, 4, 9].map(backoffMs)).toEqual([1_000, 2_000, 30_000, 30_000]);
    expect(nodeDnsName("pc-host", "tesseract.internal.", null)).toBe("pc-host.tesseract.internal");
    expect(nodeDnsName("pc-host", "x", status("running", { dnsName: "pc-host-1.x." }))).toBe("pc-host-1.x");
    expect(hostTailnetEnv(null)).toEqual({});
    expect(hostTailnetEnv({ shell: "http://h:7701", workspace: "http://h:7702" })).toEqual({
      TESSERACT_HOST_SHELL_BIND: "127.0.0.1",
      TESSERACT_HOST_SHELL_PUBLIC_URL: "http://h:7701",
      TESSERACT_HOST_WORKSPACE_BIND: "127.0.0.1",
      TESSERACT_HOST_WORKSPACE_PUBLIC_URL: "http://h:7702",
    });
  });
});

describe("HostTailnetSupervisor", () => {
  it("joins with a desktop key on the first run and reports the public URLs", async () => {
    const { supervisor, spawned, keys, children } = setup();
    await supervisor.start("pc-host");
    expect(keys).toEqual(["pc-host"]);
    expect(spawned[0]).toContain("--auth-key");
    expect(supervisor.urls()).toEqual({ shell: "http://pc-host.tesseract.internal:7701", workspace: "http://pc-host.tesseract.internal:7702" });
    children[0]!.print("some log line");
    children[0]!.print(status("running", { dnsName: "pc-host.tesseract.internal.", magicDnsSuffix: "tesseract.internal" }));
    await tick();
    expect(supervisor.state()).toMatchObject({ status: "running", error: null });
    expect(supervisor.state().log).toEqual(["some log line"]);
  });

  it("restarts without a key from saved state, with backoff after a crash", async () => {
    const { supervisor, spawned, keys, children, retries, joinState } = setup();
    await supervisor.start("pc-host");
    joinState();
    children[0]!.exit(1);
    expect(supervisor.state().status).toBe("error");
    expect(retries.map((retry) => retry.ms)).toEqual([1_000]);
    retries[0]!.run();
    await tick();
    expect(spawned).toHaveLength(2);
    expect(spawned[1]).not.toContain("--auth-key");
    expect(keys).toHaveLength(1);
    children[1]!.exit(1);
    expect(retries.map((retry) => retry.ms)).toEqual([1_000, 2_000]);
  });

  it("fetches a fresh key when the saved node needs login", async () => {
    const { supervisor, spawned, keys, children, joinState } = setup();
    await supervisor.start("pc-host");
    joinState();
    await supervisor.restart();
    expect(spawned[1]).not.toContain("--auth-key");
    children[1]!.print(status("needs_login"));
    await tick();
    expect(keys).toHaveLength(2);
    expect(spawned[2]).toContain("--auth-key");
    children[2]!.print(status("needs_login", { error: "key expired" }));
    await tick();
    expect(supervisor.state()).toMatchObject({ status: "needs_login", error: "key expired" });
    expect(spawned).toHaveLength(3);
  });

  it("stops with SIGTERM and doesn't restart", async () => {
    const { supervisor, children, retries } = setup();
    await supervisor.start("pc-host");
    await supervisor.stop();
    expect(children[0]!.signals).toEqual(["SIGTERM"]);
    expect(retries).toEqual([]);
    expect(supervisor.state()).toMatchObject({ status: "off", urls: null });
  });

  it("reports a missing binary and a failed key", async () => {
    const missing = new HostTailnetSupervisor({
      binary: () => null,
      stateDir: "/nowhere",
      metaFile: "/nowhere.json",
      deviceKey: async () => KEY,
      onChange: () => undefined,
    });
    await missing.start("pc-host");
    expect(missing.state().status).toBe("missing");
    const { supervisor, spawned } = setup({ keyError: new Error("Sign in first") });
    await supervisor.start("pc-host");
    expect(supervisor.state()).toMatchObject({ status: "error", error: "Couldn't get a device key: Sign in first", urls: null });
    expect(spawned).toEqual([]);
  });
});
