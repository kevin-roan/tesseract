import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import type { DeviceKey, TailnetStatus } from "@tesseract/protocol";
import type { HostTailnetStatus } from "../../shared/contracts/tailnet";
import { redact } from "../log";
import { HOST_TAILNET } from "./constants";
import { HOST_TAILNET_LABELS as L } from "./labels";
import { backoffMs, nodeDnsName, parseStatusLine, tailnetUpArgs, tailnetUrls } from "./model";

export type TailnetSpawn = (file: string, args: readonly string[], options: SpawnOptions) => ChildProcess;

/** What the node joined with: kept next to the state dir so restarts need no new key. */
export interface TailnetMeta {
  loginServer: string;
  magicDnsSuffix: string;
  hostname: string;
}

export interface SupervisorState {
  status: HostTailnetStatus;
  hostname: string | null;
  node: TailnetStatus | null;
  urls: { shell: string; workspace: string } | null;
  error: string | null;
  log: string[];
}

export interface HostTailnetDeps {
  /** Absolute path of `tesseract-tailnet`, null when this build has none. */
  binary(): string | null;
  stateDir: string;
  metaFile: string;
  /** A `desktop` device key for `hostname` (account service); throws when signed out. */
  deviceKey(hostname: string): Promise<DeviceKey>;
  onChange(state: SupervisorState): void;
  spawn?: TailnetSpawn;
  exists?(path: string): boolean;
  now?(): number;
  schedule?(callback: () => void, ms: number): () => void;
}

const OFF: SupervisorState = { status: "off", hostname: null, node: null, urls: null, error: null, log: [] };

function alive(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runs the bundled `tesseract-tailnet up` (ADR 0014 §3, §6) so the host shell and host workspace are reachable on
 * the Tesseract Network: fetches a `desktop` key on the first run, follows the status lines, restarts with
 * backoff when it crashes and stops it with SIGTERM.
 */
export class HostTailnetSupervisor {
  private current: SupervisorState = OFF;
  private child: ChildProcess | null = null;
  private exit: Promise<void> | null = null;
  private hostname: string | null = null;
  private meta: TailnetMeta | null = null;
  private attempt = 0;
  private startedAt = 0;
  private usedKey = false;
  private cancelRetry: (() => void) | null = null;
  private launching: Promise<void> | null = null;

  constructor(private readonly deps: HostTailnetDeps) {}

  state(): SupervisorState {
    return this.current;
  }

  /** Public URLs for the daemons: set while the node is wanted and its name is known, so they don't restart twice. */
  urls(): { shell: string; workspace: string } | null {
    return this.current.urls;
  }

  async start(hostname: string): Promise<void> {
    if (this.hostname === hostname && (this.child || this.launching || this.cancelRetry)) return;
    if (this.hostname && this.hostname !== hostname) await this.stop();
    this.hostname = hostname;
    this.attempt = 0;
    await this.launch(false);
  }

  async stop(): Promise<void> {
    this.hostname = null;
    this.cancelRetry?.();
    this.cancelRetry = null;
    // SIGTERM goes out synchronously, so a quitting app doesn't leave the node behind.
    const killing = this.kill();
    await this.launching?.catch(() => undefined);
    await killing;
    await this.kill();
    this.set({ ...OFF });
  }

  async restart(): Promise<void> {
    const hostname = this.hostname;
    if (!hostname) return;
    await this.stop();
    await this.start(hostname);
  }

  /** Stops the node and forgets its identity (sign-out, account deletion, another server). */
  async reset(): Promise<void> {
    await this.stop();
    this.meta = null;
    await rm(this.deps.stateDir, { recursive: true, force: true }).catch(() => undefined);
    await rm(this.deps.metaFile, { force: true }).catch(() => undefined);
  }

  private launch(forceKey: boolean): Promise<void> {
    this.launching ??= this.spawnNode(forceKey).finally(() => {
      this.launching = null;
    });
    return this.launching;
  }

  private async spawnNode(forceKey: boolean): Promise<void> {
    const hostname = this.hostname;
    if (!hostname) return;
    const binary = this.deps.binary();
    const exists = this.deps.exists ?? existsSync;
    if (!binary || !exists(binary)) {
      this.set({ ...OFF, status: "missing", hostname, error: L.missing(binary ?? HOST_TAILNET.binary) });
      return;
    }
    this.set({ status: "starting", hostname, node: null, error: null });
    let authKey: string | null = null;
    let meta = this.meta ?? (await this.readMeta());
    if (forceKey || !meta || meta.hostname !== hostname || !this.hasState()) {
      try {
        const key = await this.deps.deviceKey(hostname);
        authKey = key.authKey;
        meta = { loginServer: key.loginServer, magicDnsSuffix: key.magicDnsSuffix, hostname };
        await this.writeMeta(meta);
      } catch (error) {
        if (this.hostname !== hostname) return;
        this.set({ status: "error", error: L.keyFailed(message(error)), urls: null });
        return;
      }
    }
    if (this.hostname !== hostname) return;
    this.meta = meta;
    this.usedKey = authKey !== null;
    this.set({ urls: tailnetUrls(nodeDnsName(hostname, meta.magicDnsSuffix, null)) });
    let child: ChildProcess;
    try {
      child = (this.deps.spawn ?? nodeSpawn)(binary, tailnetUpArgs({ stateDir: this.deps.stateDir, loginServer: meta.loginServer, authKey, hostname }), {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      this.set({ status: "error", error: message(error) });
      this.scheduleRestart();
      return;
    }
    this.child = child;
    this.startedAt = this.now();
    this.exit = new Promise((resolve) => {
      child.once("close", (code, signal) => {
        this.onExit(child, code, signal);
        resolve();
      });
      child.once("error", (error) => {
        if (child !== this.child) return resolve();
        this.child = null;
        this.set({ status: "error", error: error.message });
        this.scheduleRestart();
        resolve();
      });
    });
    if (child.stdout) createInterface({ input: child.stdout, crlfDelay: Infinity }).on("line", (line) => this.onStdout(child, line));
    if (child.stderr) createInterface({ input: child.stderr, crlfDelay: Infinity }).on("line", (line) => this.appendLog(child, line));
  }

  private onStdout(child: ChildProcess, line: string): void {
    if (child !== this.child) return;
    const node = parseStatusLine(line);
    if (!node) return this.appendLog(child, line);
    const meta = this.meta;
    const hostname = this.hostname;
    if (node.magicDnsSuffix && meta && node.magicDnsSuffix.replace(/\.$/, "") !== meta.magicDnsSuffix) {
      this.meta = { ...meta, magicDnsSuffix: node.magicDnsSuffix.replace(/\.$/, "") };
      void this.writeMeta(this.meta).catch(() => undefined);
    }
    const urls = hostname && this.meta ? tailnetUrls(nodeDnsName(hostname, this.meta.magicDnsSuffix, node)) : this.current.urls;
    if (node.state === "needs_login") {
      if (!this.usedKey) {
        // The saved node state is gone or was removed from the account: join again with a fresh key.
        this.set({ node, status: "starting" });
        void this.kill().then(() => this.launch(true));
        return;
      }
      this.set({ node, status: "needs_login", error: node.error ?? L.needsLogin });
      return;
    }
    if (node.state === "running") this.attempt = 0;
    const status: HostTailnetStatus = node.state === "running" ? "running" : node.state === "error" ? "error" : "starting";
    this.set({ node, status, urls, error: node.state === "error" ? node.error : null });
  }

  private appendLog(child: ChildProcess, line: string): void {
    if (child !== this.child || !line.trim()) return;
    this.current = { ...this.current, log: [...this.current.log, redact(line)].slice(-HOST_TAILNET.logLimit) };
  }

  private onExit(child: ChildProcess, code: number | null, signal: NodeJS.Signals | null): void {
    if (child !== this.child) return;
    this.child = null;
    this.exit = null;
    if (!this.hostname) return;
    if (this.now() - this.startedAt >= HOST_TAILNET.stableMs) this.attempt = 0;
    this.set({ status: "error", error: this.current.error ?? L.exited(code, signal), node: null });
    this.scheduleRestart();
  }

  private scheduleRestart(): void {
    if (!this.hostname || this.cancelRetry) return;
    const delay = backoffMs(this.attempt);
    this.attempt += 1;
    const schedule =
      this.deps.schedule ??
      ((callback: () => void, ms: number) => {
        const timer = setTimeout(callback, ms);
        return () => clearTimeout(timer);
      });
    this.cancelRetry = schedule(() => {
      this.cancelRetry = null;
      if (this.hostname && !this.child) void this.launch(false);
    }, delay);
  }

  private async kill(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.child = null;
    const exit = this.exit ?? Promise.resolve();
    this.exit = null;
    if (!alive(child)) return;
    child.kill("SIGTERM");
    const timer = setTimeout(() => {
      if (alive(child)) child.kill("SIGKILL");
    }, HOST_TAILNET.stopGraceMs);
    await Promise.race([exit, new Promise((resolve) => setTimeout(resolve, HOST_TAILNET.stopGraceMs + 500))]);
    clearTimeout(timer);
  }

  private hasState(): boolean {
    try {
      return readdirSync(this.deps.stateDir).length > 0;
    } catch {
      return false;
    }
  }

  private async readMeta(): Promise<TailnetMeta | null> {
    try {
      const data = JSON.parse(await readFile(this.deps.metaFile, "utf8")) as Partial<TailnetMeta>;
      if (typeof data.loginServer === "string" && typeof data.magicDnsSuffix === "string" && typeof data.hostname === "string") {
        return { loginServer: data.loginServer, magicDnsSuffix: data.magicDnsSuffix, hostname: data.hostname };
      }
    } catch {
      // first run
    }
    return null;
  }

  private async writeMeta(meta: TailnetMeta): Promise<void> {
    await mkdir(dirname(this.deps.metaFile), { recursive: true });
    await writeFile(this.deps.metaFile, `${JSON.stringify(meta, null, 2)}\n`, { mode: 0o600 });
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  private set(patch: Partial<SupervisorState>): void {
    this.current = { ...this.current, ...patch };
    this.deps.onChange(this.current);
  }
}
