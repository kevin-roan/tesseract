import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { HostShellClient, TheOneClient, type FetchLike } from "@theone/client";
import type { AndroidLinkInfo, HostAndroidStatus } from "@theone/protocol";
import type { HostPairing, HostShellState } from "../../shared/contracts/hostShell";
import { redact } from "../log";
import { runCommand, type CommandOptions, type CommandResult } from "../process";
import { nodeFileProbe, supervisedCommand, type FileProbe } from "./command";
import { HOST_ARGS, HOST_SHELL, INITIAL_HOST_SHELL_STATE, LOG_FLUSH_MS } from "./constants";
import type { HostEnv } from "./env";
import { HOST_LABELS } from "./labels";
import {
  appendLog,
  cliError,
  describeHostError,
  healthUrl,
  hostToken,
  HostShellError,
  isAuthError,
  isHostHealth,
  isOwned,
  isServing,
  isValidPin,
  parsePairing,
  sessionExpiry,
  sessionLive,
  sessionRequiredError,
} from "./model";

export type SpawnFn = (file: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
export type RunFn = (file: string, args: readonly string[], options: CommandOptions) => Promise<CommandResult>;

export interface HostShellDeps {
  command(): string[];
  env(): HostEnv | Promise<HostEnv>;
  platform: NodeJS.Platform;
  onChange(state: HostShellState): void;
  autostart?: boolean;
  saveAutostart?(enabled: boolean): Promise<void>;
  spawn?: SpawnFn;
  run?: RunFn;
  fetch?: FetchLike;
  now?(): number;
  files?: FileProbe;
}

interface PinSession {
  token: string;
  expiresAt: number;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function alive(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class HostShellService {
  private current: HostShellState;
  private child: ChildProcess | null = null;
  private childExit: Promise<void> | null = null;
  private launchedEnv: HostEnv | null = null;
  private stopRequested = false;
  private killTimer: ReturnType<typeof setTimeout> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private session: PinSession | null = null;
  private refreshing: Promise<HostShellState> | null = null;
  private queued: Promise<HostShellState> | null = null;
  private starting: Promise<HostShellState> | null = null;
  private shuttingDown: Promise<void> | null = null;

  constructor(private readonly deps: HostShellDeps) {
    this.current = { ...INITIAL_HOST_SHELL_STATE, autostart: deps.autostart === true };
  }

  state(): HostShellState {
    return this.current;
  }

  hasChild(): boolean {
    return this.child !== null && alive(this.child);
  }

  async env(): Promise<HostEnv> {
    return this.deps.env();
  }

  init(): Promise<HostShellState> {
    return this.current.autostart ? this.start() : this.refresh();
  }

  start(): Promise<HostShellState> {
    if (isOwned(this.current) || this.current.status === "external") return Promise.resolve(this.current);
    this.starting ??= this.launch().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  async stop(): Promise<HostShellState> {
    const child = this.child;
    if (!child || !alive(child)) return this.current;
    this.stopRequested = true;
    this.set({ status: "stopping" });
    child.kill("SIGTERM");
    this.clearKillTimer();
    this.killTimer = setTimeout(() => {
      if (alive(child)) child.kill("SIGKILL");
    }, HOST_SHELL.stopGraceMs);
    return this.current;
  }

  async restart(): Promise<HostShellState> {
    if (!this.hasChild()) return this.current;
    const exit = this.childExit ?? Promise.resolve();
    await this.stop();
    await exit;
    return this.start();
  }

  async restartIfEnvChanged(keys: readonly string[]): Promise<HostShellState> {
    const launched = this.launchedEnv;
    if (!this.hasChild() || !launched) return this.current;
    const next = await this.deps.env();
    return keys.some((key) => launched[key] !== next[key]) ? this.restart() : this.current;
  }

  refresh(): Promise<HostShellState> {
    if (!this.refreshing) {
      this.refreshing = this.probe().finally(() => {
        this.refreshing = null;
      });
      return this.refreshing;
    }
    this.queued ??= this.refreshing.then(() => {
      this.queued = null;
      return this.refresh();
    });
    return this.queued;
  }

  async setPin(pin: string): Promise<HostShellState> {
    if (!isValidPin(pin)) throw new HostShellError(HOST_LABELS.invalidPin, "invalid_argument");
    await this.cli(HOST_ARGS.pin, `${pin}\n`);
    this.forgetSession();
    return this.refresh();
  }

  async rotateToken(): Promise<HostShellState> {
    await this.cli(HOST_ARGS.rotate);
    return this.refresh();
  }

  async setAutostart(enabled: boolean): Promise<HostShellState> {
    await this.deps.saveAutostart?.(enabled);
    this.set({ autostart: enabled });
    return this.current;
  }

  async unlock(pin: string): Promise<HostShellState> {
    if (!isValidPin(pin)) throw new HostShellError(HOST_LABELS.invalidPin, "invalid_argument");
    if (!this.current.pairing) await this.refresh();
    const pairing = this.current.pairing;
    if (!pairing || !isServing(this.current)) throw new HostShellError(HOST_LABELS.notRunning);
    let session: PinSession;
    try {
      const issued = await this.hostClient(pairing).unlock(pin);
      session = { token: issued.session, expiresAt: sessionExpiry(issued.expiresAt) };
    } catch (error) {
      throw new HostShellError(describeHostError(error, pairing.url), isAuthError(error) ? "forbidden" : "unavailable");
    }
    this.session = session;
    this.set({ sessionExpiresAt: session.expiresAt });
    return this.current;
  }

  async lock(): Promise<HostShellState> {
    const session = this.session;
    const pairing = this.current.pairing;
    this.forgetSession();
    if (session && pairing) await this.hostClient(pairing).lock(session.token).catch(() => undefined);
    return this.current;
  }

  androidStatus(): Promise<HostAndroidStatus> {
    return this.hostCall((client) => client.hostAndroidStatus());
  }

  startEmulator(avd: string): Promise<HostAndroidStatus> {
    if (typeof avd !== "string" || !avd.trim()) throw new HostShellError(HOST_LABELS.invalidAvd, "invalid_argument");
    return this.hostCall(async (client) => {
      await client.startEmulator({ avd: avd.trim() });
      return client.hostAndroidStatus();
    });
  }

  stopEmulator(): Promise<HostAndroidStatus> {
    return this.hostCall(async (client) => {
      await client.stopEmulator();
      return client.hostAndroidStatus();
    });
  }

  linkSandbox(sandboxUrl: string, token: string): Promise<AndroidLinkInfo> {
    if (typeof sandboxUrl !== "string" || !sandboxUrl.trim() || typeof token !== "string" || !token) {
      throw new HostShellError(HOST_LABELS.invalidSandbox, "invalid_argument");
    }
    return this.hostCall((client) => client.linkSandbox({ sandboxUrl: sandboxUrl.trim(), token }));
  }

  shutdown(): Promise<void> {
    this.shuttingDown ??= this.terminate().finally(() => {
      this.shuttingDown = null;
    });
    return this.shuttingDown;
  }

  private async terminate(): Promise<void> {
    this.clearFlushTimer();
    this.session = null;
    const child = this.child;
    if (!child || !alive(child)) return;
    this.stopRequested = true;
    child.kill("SIGTERM");
    await Promise.race([this.childExit ?? Promise.resolve(), delay(HOST_SHELL.shutdownWaitMs)]);
    if (alive(child)) child.kill("SIGKILL");
    this.clearKillTimer();
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  private hostClient(pairing: HostPairing): HostShellClient {
    return new HostShellClient({
      baseUrl: pairing.url,
      token: hostToken(pairing.link),
      timeoutMs: HOST_SHELL.hostTimeoutMs,
      fetch: this.deps.fetch,
    });
  }

  private sessionClient(): TheOneClient {
    const state = this.current;
    if (!isServing(state) || !state.pairing) throw new HostShellError(HOST_LABELS.notRunning);
    if (!state.pairing.pinSet) throw new HostShellError(HOST_LABELS.noPin);
    const session = this.session;
    if (!session || !sessionLive(session.expiresAt, this.now())) {
      this.forgetSession();
      throw sessionRequiredError();
    }
    return new TheOneClient({
      baseUrl: state.pairing.url,
      token: session.token,
      timeoutMs: HOST_SHELL.hostTimeoutMs,
      fetch: this.deps.fetch,
    });
  }

  private async hostCall<T>(call: (client: TheOneClient) => Promise<T>): Promise<T> {
    const client = this.sessionClient();
    try {
      return await call(client);
    } catch (error) {
      if (isAuthError(error)) {
        this.forgetSession();
        throw sessionRequiredError();
      }
      throw new HostShellError(describeHostError(error, client.baseUrl));
    }
  }

  private forgetSession(): void {
    this.session = null;
    if (this.current.sessionExpiresAt !== null) this.set({ sessionExpiresAt: null });
  }

  private async cli(args: readonly string[], input?: string): Promise<string> {
    const [file, ...prefix] = this.deps.command();
    if (!file) throw new HostShellError(HOST_LABELS.failed, "internal");
    const env = await this.deps.env();
    const run = this.deps.run ?? runCommand;
    const result = await run(file, [...prefix, HOST_ARGS.host, ...args], {
      timeoutMs: HOST_SHELL.cliTimeoutMs,
      env,
      input,
    });
    if (result.timedOut) throw new HostShellError(HOST_LABELS.cliTimeout, "timeout");
    if (result.code !== 0) throw new HostShellError(cliError(`${result.stdout}\n${result.stderr}`, result.code), "internal");
    return result.stdout;
  }

  private async answers(baseUrl: string): Promise<boolean> {
    const fetchImpl = this.deps.fetch ?? (globalThis.fetch as unknown as FetchLike);
    try {
      const response = await fetchImpl(healthUrl(baseUrl), {
        method: "GET",
        headers: {},
        signal: AbortSignal.timeout(HOST_SHELL.healthTimeoutMs),
      });
      if (!response.ok) return false;
      return isHostHealth(JSON.parse(await response.text()));
    } catch {
      return false;
    }
  }

  private async probe(): Promise<HostShellState> {
    const owned = isOwned(this.current);
    try {
      const pairing = parsePairing(await this.cli(HOST_ARGS.pair));
      const external = !owned && (await this.answers(pairing.url));
      const current = this.current;
      if (isOwned(current)) this.set({ pairing });
      else if (external) this.set({ pairing, status: "external", error: null });
      else if (current.status === "external") {
        this.session = null;
        this.set({ pairing, status: "stopped", sessionExpiresAt: null });
      } else this.set({ pairing, error: current.status === "failed" ? current.error : null });
    } catch (error) {
      const current = this.current;
      this.set({ error: message(error), status: isOwned(current) ? current.status : "failed" });
    }
    return this.current;
  }

  private async launch(): Promise<HostShellState> {
    await this.refresh();
    if (isOwned(this.current) || this.current.status === "external") return this.current;
    let child: ChildProcess;
    try {
      const env = await this.deps.env();
      const command = supervisedCommand(
        [...this.deps.command(), HOST_ARGS.host, ...HOST_ARGS.serve],
        env,
        this.deps.platform,
        this.deps.files ?? nodeFileProbe,
      );
      const [file, ...args] = command;
      if (!file) throw new HostShellError(HOST_LABELS.failed, "internal");
      child = (this.deps.spawn ?? spawn)(file, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env,
        windowsHide: true,
      });
      this.launchedEnv = env;
    } catch (error) {
      this.set({ status: "failed", error: message(error) });
      return this.current;
    }
    this.child = child;
    this.stopRequested = false;
    this.session = null;
    this.set({ status: "starting", error: null, log: [], sessionExpiresAt: null });
    this.childExit = new Promise((resolve) => {
      child.once("close", (code) => {
        this.onExit(child, code);
        resolve();
      });
      child.once("error", (error) => {
        this.onSpawnError(child, error);
        resolve();
      });
    });
    this.pump(child, child.stdout);
    this.pump(child, child.stderr);
    return this.current;
  }

  private pump(child: ChildProcess, stream: Readable | null): void {
    if (!stream) return;
    createInterface({ input: stream, crlfDelay: Infinity }).on("line", (line) => this.onLine(child, line));
  }

  private onLine(child: ChildProcess, line: string): void {
    if (child !== this.child || !line) return;
    this.current = { ...this.current, log: appendLog(this.current.log, [redact(line)]) };
    if (line.includes(HOST_SHELL.listeningMarker) && this.current.status === "starting") {
      this.set({ status: "running" });
      void this.refresh();
      return;
    }
    this.scheduleFlush();
  }

  private onExit(child: ChildProcess, code: number | null): void {
    if (child !== this.child) return;
    this.child = null;
    this.childExit = null;
    this.session = null;
    this.clearKillTimer();
    if (this.stopRequested || code === 0) this.set({ status: "stopped", error: null, sessionExpiresAt: null });
    else this.set({ status: "failed", error: cliError(this.current.log.join("\n"), code), sessionExpiresAt: null });
    this.stopRequested = false;
  }

  private onSpawnError(child: ChildProcess, error: Error): void {
    if (child !== this.child) return;
    this.child = null;
    this.childExit = null;
    this.clearKillTimer();
    this.set({ status: "failed", error: error.message });
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.deps.onChange(this.current);
    }, LOG_FLUSH_MS);
  }

  private clearFlushTimer(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private clearKillTimer(): void {
    if (this.killTimer) clearTimeout(this.killTimer);
    this.killTimer = null;
  }

  private set(patch: Partial<HostShellState>): void {
    this.clearFlushTimer();
    this.current = { ...this.current, ...patch };
    this.deps.onChange(this.current);
  }
}
