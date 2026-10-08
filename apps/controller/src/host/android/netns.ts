import { chmodSync, existsSync, mkdirSync, readFileSync, readlinkSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Env, RunResult } from "../../core/exec";
import type { Logger } from "../../core/logger";
import { listPids, readProcStat } from "../../core/proc";
import { terminateGroup } from "../../core/process-group";
import { DnsForwarder, EgressProxy, type EgressPolicy, type Nameserver } from "./egress";
import { HELPER_COMMAND, NETNS_PORTS, runtimePaths } from "./netns-helper";
import { boundPort, closeServer, connectTo, listen, relayServer } from "./pipe";

export type RuntimePaths = ReturnType<typeof runtimePaths>;

const DIR_MODE = 0o700;
const LOOPBACK = "127.0.0.1";
const BRIDGE_MAX_CONNECTIONS = 64;
const SWEEP_GRACE_MS = 2_000;
const POLL_MS = 100;
const PROBE_TIMEOUT_MS = 2_000;
const HELPER_WAIT_TENTHS = 100;
const EMULATOR_COMMANDS = /^(qemu-system|emulator)/;
const ENTRY = join(import.meta.dir, "..", "..", "index.ts");

/** How this binary re-invokes itself: `bun <src/index.ts>` from a checkout, the executable itself when compiled. */
export function selfCommand(): string[] {
  return import.meta.dir.startsWith("/$bunfs") || !existsSync(ENTRY) ? [process.execPath] : [process.execPath, ENTRY];
}

/** `$XDG_RUNTIME_DIR/tesseract`, else a per-user directory under the temp dir. */
export function runtimeBase(env: Env): string {
  return env.XDG_RUNTIME_DIR ? join(env.XDG_RUNTIME_DIR, "tesseract") : join(tmpdir(), `tesseract-${process.getuid?.() ?? "user"}`);
}

export const runtimeDir = (base: string, consolePort: number) => join(base, `emulator-${consolePort}`);

const quote = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;

/** Extra emulator flags inside the namespace: all guest TCP through the helper's proxy, DNS to the helper. */
export function isolatedEmulatorArgs(): string[] {
  return ["-http-proxy", `http://${LOOPBACK}:${NETNS_PORTS.proxy}`, "-dns-server", LOOPBACK];
}

/**
 * `unshare --user --map-root-user --net` running a shell that brings up `lo` and a dummy
 * interface (getaddrinfo's AI_ADDRCONFIG needs a non-loopback IPv4 and IPv6 address),
 * records its pid, starts the helper and execs the emulator.
 */
export function launcherArgv(options: { unshare: string; ip: string; dir: string; consolePort: number; helper: string[]; emulator: string[] }): string[] {
  const paths = runtimePaths(options.dir);
  const helper = [...options.helper, "host", HELPER_COMMAND, "--dir", options.dir, "--console-port", String(options.consolePort)].map(quote).join(" ");
  const script = [
    "set -e",
    `IP=${quote(options.ip)}`,
    '"$IP" link set lo up',
    '"$IP" link add dummy0 type dummy',
    '"$IP" addr add 10.254.254.1/32 dev dummy0',
    '"$IP" addr add fd00:254::1/128 dev dummy0',
    '"$IP" link set dummy0 up',
    `echo $$ > ${quote(paths.emulatorPid)}`,
    `${helper} --parent $$ </dev/null &`,
    "i=0",
    `while [ ! -e ${quote(paths.helperPid)} ]; do`,
    `  i=$((i+1)); [ "$i" -le ${HELPER_WAIT_TENTHS} ] || { echo "The emulator network helper did not start" >&2; exit 1; }`,
    "  sleep 0.1",
    "done",
    'exec "$@"',
  ].join("\n");
  return [options.unshare, "--user", "--map-root-user", "--net", "--", "/bin/sh", "-c", script, "tesseract-emulator", ...options.emulator];
}

export function netnsOf(pid: number | "self"): string | null {
  try {
    return readlinkSync(`/proc/${pid}/ns/net`);
  } catch {
    return null;
  }
}

const ownUid = () => process.getuid?.() ?? -1;

function ownedBy(pid: number, uid: number): boolean {
  try {
    return statSync(`/proc/${pid}`).uid === uid;
  } catch {
    return false;
  }
}

/** Our processes in network namespace `ns` (never the daemon's own namespace). */
export function netnsMembers(ns: string): number[] {
  if (!ns || ns === netnsOf("self")) return [];
  const uid = ownUid();
  return (listPids() ?? []).filter((pid) => pid !== process.pid && ownedBy(pid, uid) && netnsOf(pid) === ns);
}

function alive(pid: number): boolean {
  const stat = readProcStat(pid);
  return stat !== null && stat.state !== "Z" && stat.state !== "X";
}

function signal(pids: number[], name: NodeJS.Signals): void {
  for (const pid of pids) {
    try {
      process.kill(pid, name);
    } catch {}
  }
}

async function waitGone(pids: () => number[], timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pids().length === 0) return true;
    await Bun.sleep(POLL_MS);
  }
  return pids().length === 0;
}

/** SIGTERM to every process of ours in `ns` (the emulator's own adb server ignores it), SIGKILL after `graceMs`. */
export async function sweepNetns(ns: string, graceMs = SWEEP_GRACE_MS): Promise<void> {
  const members = () => netnsMembers(ns).filter(alive);
  if (members().length === 0) return;
  signal(members(), "SIGTERM");
  if (await waitGone(members, graceMs)) return;
  signal(members(), "SIGKILL");
  await waitGone(members, SWEEP_GRACE_MS);
}

function readNumber(path: string): number | null {
  try {
    const value = Number(readFileSync(path, "utf8").trim());
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function socketAnswers(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connectTo({ path });
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

export type RuntimeOptions = {
  dir: string;
  consolePort: number;
  /** `TESSERACT_EMULATOR_ADB_PORT`; else the port recorded in the directory, else a free one. */
  adbPort: number | null;
  policy: EgressPolicy;
  logger: Logger;
  /** Runs the host adb client (`adb <args>`). */
  adb: (args: string[]) => Promise<RunResult<string>>;
  nameserver?: () => Nameserver | null;
};

/**
 * The daemon's side of an emulator in its own network namespace: the DNS and proxy unix
 * sockets the helper dials, the host adb bridge `127.0.0.1:<port>` → `adbd.sock`, and the
 * runtime directory. The emulator and helper outlive the daemon; a new daemon adopts them.
 */
export class IsolatedRuntime {
  readonly paths: RuntimePaths;
  private readonly servers: Server[] = [];
  private port = 0;
  private closed = false;

  private constructor(private readonly options: RuntimeOptions) {
    this.paths = runtimePaths(options.dir);
  }

  get serial(): string {
    return `${LOOPBACK}:${this.port}`;
  }

  get adbdPath(): string {
    return this.paths.adbd;
  }

  /** A fresh, empty runtime directory with the daemon's sockets listening. */
  static async create(options: RuntimeOptions): Promise<IsolatedRuntime> {
    mkdirSync(join(options.dir, ".."), { recursive: true, mode: DIR_MODE });
    chmodSync(join(options.dir, ".."), DIR_MODE);
    rmSync(options.dir, { recursive: true, force: true });
    mkdirSync(options.dir, { mode: DIR_MODE });
    const runtime = new IsolatedRuntime(options);
    try {
      await runtime.serve();
    } catch (error) {
      await runtime.close();
      rmSync(options.dir, { recursive: true, force: true });
      throw error;
    }
    return runtime;
  }

  /** The runtime of an emulator left running by an earlier daemon, or null (a stale directory is cleaned up). */
  static async adopt(options: RuntimeOptions): Promise<IsolatedRuntime | null> {
    if (!existsSync(options.dir)) return null;
    const runtime = new IsolatedRuntime(options);
    if (runtime.helperAlive() && (await socketAnswers(runtime.paths.adbd))) {
      await runtime.serve();
      return runtime;
    }
    options.logger.info("cleaning up a stale emulator runtime directory", { dir: options.dir });
    const ns = runtime.verifiedNetns();
    if (ns) await sweepNetns(ns);
    rmSync(options.dir, { recursive: true, force: true });
    return null;
  }

  /** The AVD recorded when the emulator was started. */
  avd(): string | null {
    return readText(this.paths.avd);
  }

  emulatorPid(): number | null {
    return readNumber(this.paths.emulatorPid);
  }

  /** The namespace recorded by the helper, if a process we started is still in it. */
  verifiedNetns(): string | null {
    const ns = readText(this.paths.netns);
    if (!ns || ns === netnsOf("self")) return null;
    const pids = [readNumber(this.paths.helperPid), readNumber(this.paths.emulatorPid)];
    return pids.some((pid) => pid !== null && alive(pid) && netnsOf(pid) === ns) ? ns : null;
  }

  helperAlive(): boolean {
    const pid = readNumber(this.paths.helperPid);
    const ns = readText(this.paths.netns);
    return pid !== null && alive(pid) && (ns === null || netnsOf(pid) === ns);
  }

  emulatorAlive(): boolean {
    const pid = readNumber(this.paths.emulatorPid);
    const ns = readText(this.paths.netns);
    return pid !== null && alive(pid) && (ns === null || netnsOf(pid) === ns);
  }

  /** `adb connect` the bridge on the host adb server; true once it is connected. */
  async connectAdb(): Promise<boolean> {
    const result = await this.options.adb(["connect", this.serial]);
    return result.ok && /connected to/.test(result.stdout) && !/failed|unable|cannot/i.test(result.stdout);
  }

  async disconnectAdb(): Promise<void> {
    if (this.port) await this.options.adb(["disconnect", this.serial]);
  }

  /**
   * Stops the emulator (SIGTERM to the emulator/qemu processes in its namespace, and to
   * `leader`'s process group when the daemon started it), SIGKILLs what remains after
   * `graceMs`, sweeps the namespace (helper, the emulator's own adb server, netsimd) and
   * removes the runtime directory.
   */
  async teardown(graceMs: number, leader: { pid: number; exited: Promise<unknown> } | null = null): Promise<void> {
    const recorded = readText(this.paths.netns) ?? (leader ? netnsOf(leader.pid) : null);
    const ns = recorded && recorded !== netnsOf("self") ? recorded : null;
    const pid = this.emulatorPid();
    const targets = () => {
      if (!ns) return pid !== null && alive(pid) ? [pid] : [];
      const inNs = netnsMembers(ns).filter((member) => EMULATOR_COMMANDS.test(readProcStat(member)?.command ?? ""));
      if (pid !== null && netnsOf(pid) === ns) inNs.push(pid);
      return [...new Set(inNs)].filter(alive);
    };
    signal(targets(), "SIGTERM");
    const group = leader ? terminateGroup(leader.pid, leader.exited, graceMs) : Promise.resolve();
    if (!(await waitGone(targets, graceMs))) signal(targets(), "SIGKILL");
    await group;
    if (ns) {
      await sweepNetns(ns);
    } else {
      const helper = readNumber(this.paths.helperPid);
      const helpers = () => (helper !== null && alive(helper) ? [helper] : []);
      signal(helpers(), "SIGTERM");
      if (!(await waitGone(helpers, SWEEP_GRACE_MS))) signal(helpers(), "SIGKILL");
    }
    await this.close();
    await this.disconnectAdb();
    rmSync(this.options.dir, { recursive: true, force: true });
  }

  /** Stops serving (the daemon is going away); the emulator keeps running. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await Promise.all(this.servers.splice(0).map((server) => closeServer(server)));
  }

  private async serve(): Promise<void> {
    const { logger, policy, nameserver } = this.options;
    const dns = new DnsForwarder(nameserver).server;
    await listen(dns, { path: this.paths.dns });
    this.servers.push(dns);
    const proxy = new EgressProxy(policy, logger).server;
    await listen(proxy, { path: this.paths.proxy });
    this.servers.push(proxy);
    const bridge = relayServer(() => ({ path: this.paths.adbd }), BRIDGE_MAX_CONNECTIONS);
    await this.listenBridge(bridge);
    this.servers.push(bridge);
    this.port = boundPort(bridge);
    writeFileSync(this.paths.adbPort, String(this.port), { mode: 0o600 });
  }

  private async listenBridge(bridge: Server): Promise<void> {
    if (this.options.adbPort !== null) {
      await listen(bridge, { host: LOOPBACK, port: this.options.adbPort });
      return;
    }
    const recorded = readNumber(this.paths.adbPort);
    if (recorded !== null) {
      try {
        await listen(bridge, { host: LOOPBACK, port: recorded });
        return;
      } catch {}
    }
    await listen(bridge, { host: LOOPBACK, port: 0 });
  }
}
