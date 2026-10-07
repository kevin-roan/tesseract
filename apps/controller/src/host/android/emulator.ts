import { closeSync, fstatSync, mkdirSync, openSync, readSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AVD_NAME_PATTERN, LIMITS, type EmulatorInfo, type StartEmulator } from "@theone/protocol";
import { conflict, errorMessage, notFound, unavailable } from "../../core/errors";
import { run, type RunResult } from "../../core/exec";
import type { Logger } from "../../core/logger";
import { terminateGroup } from "../../core/process-group";
import { nowIso } from "../../core/time";
import { emulatorSerial, sdkEnv, type AndroidConfig } from "./config";
import type { Nameserver } from "./egress";
import { IsolatedRuntime, isolatedEmulatorArgs, launcherArgv, runtimeDir, selfCommand, type RuntimeOptions } from "./netns";
import type { Endpoint } from "./pipe";

export type EmulatorOptions = {
  bootPollMs?: number;
  bootTimeoutMs?: number;
  stopGraceMs?: number;
  /** How often the daemon looks for an emulator started or stopped behind its back; 0 disables it. */
  watchMs?: number;
  /** The command that runs this binary inside the namespace (tests); defaults to this binary. */
  helperCommand?: string[];
  nameserver?: () => Nameserver | null;
  resolve?: (host: string) => Promise<string[]>;
};

type Listener = (info: EmulatorInfo) => void;

/** One emulator: `managed` when this daemon started it (`proc`), `runtime` when it runs in its own network namespace. */
type Instance = {
  managed: boolean;
  runtime: IsolatedRuntime | null;
  proc: Bun.Subprocess<"ignore", number, number> | null;
};

const COMMAND_TIMEOUT_MS = 10_000;
const LOG_LINES = 200;
const LOG_TAIL_BYTES = 64 * 1024;
const ERROR_LINE_CHARS = 300;
const DEFAULT_STOP_GRACE_MS = 20_000;
const DEFAULT_WATCH_MS = 5_000;
const ADOPTED_STOP_POLL_MS = 500;
const DIR_MODE = 0o700;
const SIZE_LINE = /^(Physical|Override) size:\s*(\d+)x(\d+)/;
const ONLINE_STATES = new Set(["device", "offline"]);

const RISK = "without it, anything with adb access to the emulator (the linked sandbox) can reach the host's loopback services (including the adb server), LAN and tailnet";

export const EMULATOR_MESSAGES = {
  notIsolated: "Emulator is not isolated; start it from the app",
  exited: "The emulator exited",
  noIsolationTools: `Emulator network isolation needs a Linux host with unshare (util-linux) and ip (iproute2); THEONE_EMULATOR_ISOLATION=none runs the emulator without isolation, but ${RISK}`,
  noUserNamespaces: (detail: string) =>
    `Emulator network isolation could not create a user and network namespace (${detail}); enable unprivileged user namespaces, or set THEONE_EMULATOR_ISOLATION=none to run without isolation, but ${RISK}`,
} as const;

const stoppedInfo = (state: "stopped" | "unavailable" = "stopped", error: string | null = null): EmulatorInfo => ({
  state,
  avd: null,
  serial: null,
  managed: false,
  isolated: false,
  width: null,
  height: null,
  startedAt: null,
  error,
});

/** `wm size`: the override size when set, else the physical size. */
export function parseWmSize(output: string): { width: number; height: number } | null {
  let size: { width: number; height: number } | null = null;
  for (const line of output.split("\n")) {
    const match = SIZE_LINE.exec(line.trim());
    if (match) size = { width: Number(match[2]), height: Number(match[3]) };
  }
  return size;
}

export function parseAvdList(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => AVD_NAME_PATTERN.test(line));
}

export function emulatorArgs(config: AndroidConfig, input: StartEmulator, isolated = false): string[] {
  const args = ["-avd", input.avd, "-port", String(config.emulatorPort), "-no-window", "-no-audio", "-no-boot-anim", "-skip-adb-auth", "-gpu", config.gpu];
  if (input.coldBoot) args.push("-no-snapshot-load");
  if (input.wipeData) args.push("-wipe-data");
  if (isolated) args.push(...isolatedEmulatorArgs());
  return args;
}

/** The last `lines` lines of a log file, read from its last 64 KiB. */
export function tailLines(path: string, lines = LOG_LINES): string[] {
  let fd: number;
  try {
    fd = openSync(path, "r");
  } catch {
    return [];
  }
  try {
    const size = fstatSync(fd).size;
    const length = Math.min(size, LOG_TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    const text = buffer.toString("utf8").split("\n");
    if (length < size) text.shift();
    return text.map((line) => line.replace(/\r$/, "")).slice(-lines);
  } finally {
    closeSync(fd);
  }
}

/**
 * The host emulator. With `isolation: "netns"` the daemon starts it in its own user and
 * network namespace (serial `127.0.0.1:<bridge port>`); otherwise on `emulator-<port>`.
 * It runs detached (`managed`), or is adopted when already running (`managed: false`).
 */
export class EmulatorManager {
  private info: EmulatorInfo;
  private instance: Instance | null = null;
  private readonly listeners = new Set<Listener>();
  private generation = 0;
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private watching = false;
  private launching = false;
  private failAfterStop: string | null = null;
  /** An adopted emulator that never booted: kept `failed` (not re-adopted) until it goes away. */
  private adoptionFailed = false;
  private isolationReason: string | null | undefined;
  private plainLog: string | null = null;
  private readonly bootPollMs: number;
  private readonly bootTimeoutMs: number;
  private readonly stopGraceMs: number;
  private readonly watchMs: number;

  constructor(
    private readonly config: AndroidConfig,
    private readonly logger: Logger,
    private readonly options: EmulatorOptions = {},
  ) {
    this.bootPollMs = options.bootPollMs ?? LIMITS.emulatorBootPollMs;
    this.bootTimeoutMs = options.bootTimeoutMs ?? LIMITS.emulatorBootTimeoutMs;
    this.stopGraceMs = options.stopGraceMs ?? DEFAULT_STOP_GRACE_MS;
    this.watchMs = options.watchMs ?? DEFAULT_WATCH_MS;
    this.info = this.idle();
  }

  /** The adb serial of the current emulator (`127.0.0.1:<port>` when isolated). */
  get serial(): string {
    return this.instance?.runtime?.serial ?? emulatorSerial(this.config);
  }

  /** Where the sandbox link reaches the current emulator's adbd. */
  adbdEndpoint(): Endpoint {
    const runtime = this.instance?.runtime;
    return runtime ? { path: runtime.adbdPath } : { host: "127.0.0.1", port: this.config.emulatorPort + 1 };
  }

  /** Why the current emulator must not be linked to the sandbox, or null. */
  linkRefusal(): string | null {
    return this.config.isolation === "netns" && this.instance && !this.instance.runtime ? EMULATOR_MESSAGES.notIsolated : null;
  }

  /** Why the emulator cannot be started, or null. */
  unavailableReason(): string | null {
    if (!this.config.sdkRoot) return "No Android SDK found; set THEONE_ANDROID_SDK_ROOT";
    if (!this.config.emulator) return `The Android emulator is not installed in ${this.config.sdkRoot}`;
    if (!this.config.adb) return "adb is not installed on the host; set THEONE_ADB";
    if (this.config.isolation === "netns") return this.probeIsolation();
    return null;
  }

  current(): EmulatorInfo {
    return { ...this.info };
  }

  get running(): boolean {
    return this.info.state === "running";
  }

  get logs(): string[] {
    const path = this.instance?.runtime?.paths.log ?? this.plainLog;
    return path ? tailLines(path) : [];
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async listAvds(): Promise<string[]> {
    if (!this.config.emulator) return [];
    const result = await run([this.config.emulator, "-list-avds"], { env: sdkEnv(this.config), timeoutMs: COMMAND_TIMEOUT_MS });
    return result.ok ? parseAvdList(result.stdout) : [];
  }

  /** Adopts an emulator already running (isolated or on `emulator-<port>`) and starts watching for outside changes. */
  async init(): Promise<void> {
    if (this.config.isolation === "none") this.logger.warn("emulator network isolation is off (THEONE_EMULATOR_ISOLATION=none)");
    await this.adoptIfPresent();
    if (this.watchMs > 0 && this.config.adb) {
      this.watchTimer = setInterval(() => void this.watch(), this.watchMs);
      this.watchTimer.unref?.();
    }
  }

  async start(input: StartEmulator): Promise<EmulatorInfo> {
    const reason = this.unavailableReason();
    if (reason) throw unavailable(reason);
    this.assertIdle();
    if (!(await this.listAvds()).includes(input.avd)) throw notFound(`AVD ${input.avd} not found`);
    if (await this.adoptIfPresent()) throw conflict(`An emulator is already running as ${this.serial}`);
    this.assertIdle();
    this.launching = true;
    try {
      return this.config.isolation === "netns" ? await this.startIsolated(input) : this.startPlain(input);
    } finally {
      this.launching = false;
    }
  }

  /** Returns at once with `stopping`; the state becomes `stopped` when the emulator is gone. */
  stop(): EmulatorInfo {
    const instance = this.instance;
    const state = this.info.state;
    const stoppable = state === "starting" || state === "running" || (state === "failed" && this.adoptionFailed);
    if (!instance || !stoppable) return this.current();
    const generation = ++this.generation;
    this.adoptionFailed = false;
    this.set({ ...this.info, state: "stopping" });
    void this.teardown(instance, generation);
    return this.current();
  }

  /** Stops watching and serving; the emulator keeps running for the next daemon to adopt. */
  async shutdown(): Promise<void> {
    if (this.watchTimer) clearInterval(this.watchTimer);
    this.watchTimer = null;
    this.generation += 1;
    this.listeners.clear();
    const runtime = this.instance?.runtime;
    this.instance = null;
    if (runtime) {
      await runtime.close();
      await runtime.disconnectAdb();
    }
  }

  private assertIdle(): void {
    if (this.launching || this.instance || (this.info.state !== "stopped" && this.info.state !== "failed")) {
      throw conflict(`The emulator is ${this.launching ? "starting" : this.info.state}`);
    }
  }

  private probeIsolation(): string | null {
    if (this.isolationReason !== undefined) return this.isolationReason;
    const { unshare, ip } = this.config;
    if (!unshare || !ip) return (this.isolationReason = EMULATOR_MESSAGES.noIsolationTools);
    try {
      const result = Bun.spawnSync([unshare, "--user", "--map-root-user", "--net", "--", ip, "link", "add", "theone0", "type", "dummy"], {
        stdout: "ignore",
        stderr: "pipe",
        timeout: COMMAND_TIMEOUT_MS,
      });
      const detail = result.stderr.toString().trim().split("\n")[0] || `exit code ${result.exitCode}`;
      this.isolationReason = result.success ? null : EMULATOR_MESSAGES.noUserNamespaces(detail);
    } catch (error) {
      this.isolationReason = EMULATOR_MESSAGES.noUserNamespaces(errorMessage(error));
    }
    if (this.isolationReason) this.logger.warn("emulator network isolation unavailable", { reason: this.isolationReason });
    return this.isolationReason;
  }

  private runtimeOptions(): RuntimeOptions {
    return {
      dir: runtimeDir(this.config.runtimeDir, this.config.emulatorPort),
      consolePort: this.config.emulatorPort,
      adbPort: this.config.adbBridgePort,
      policy: { allow: this.config.allowNets, resolve: this.options.resolve },
      logger: this.logger,
      adb: (args) => run([this.config.adb ?? "adb", ...args], { env: sdkEnv(this.config), timeoutMs: COMMAND_TIMEOUT_MS }),
      nameserver: this.options.nameserver,
    };
  }

  private spawn(argv: string[], log: string, flags: "a" | "w"): Bun.Subprocess<"ignore", number, number> {
    const fd = openSync(log, flags, 0o600);
    try {
      return Bun.spawn(argv, { env: sdkEnv(this.config), stdin: "ignore", stdout: fd, stderr: fd, detached: true });
    } finally {
      closeSync(fd);
    }
  }

  private startPlain(input: StartEmulator): EmulatorInfo {
    mkdirSync(this.config.runtimeDir, { recursive: true, mode: DIR_MODE });
    const log = join(this.config.runtimeDir, `emulator-${this.config.emulatorPort}.log`);
    const args = emulatorArgs(this.config, input);
    let proc: Bun.Subprocess<"ignore", number, number>;
    try {
      proc = this.spawn([this.config.emulator ?? "emulator", ...args], log, "w");
    } catch (error) {
      throw unavailable(`Could not start the emulator: ${errorMessage(error)}`);
    }
    this.plainLog = log;
    this.launched({ managed: true, runtime: null, proc }, input.avd, emulatorSerial(this.config));
    this.logger.info("emulator started", { avd: input.avd, pid: proc.pid, args: args.join(" ") });
    return this.current();
  }

  private async startIsolated(input: StartEmulator): Promise<EmulatorInfo> {
    let runtime: IsolatedRuntime;
    try {
      runtime = await IsolatedRuntime.create(this.runtimeOptions());
    } catch (error) {
      throw unavailable(`Could not prepare the emulator's network isolation: ${errorMessage(error)}`);
    }
    writeFileSync(runtime.paths.avd, input.avd, { mode: 0o600 });
    const args = emulatorArgs(this.config, input, true);
    const argv = launcherArgv({
      unshare: this.config.unshare ?? "unshare",
      ip: this.config.ip ?? "ip",
      dir: runtime.paths.dir,
      consolePort: this.config.emulatorPort,
      helper: this.options.helperCommand ?? selfCommand(),
      emulator: [this.config.emulator ?? "emulator", ...args],
    });
    let proc: Bun.Subprocess<"ignore", number, number>;
    try {
      proc = this.spawn(argv, runtime.paths.log, "a");
    } catch (error) {
      await runtime.teardown(0);
      throw unavailable(`Could not start the emulator: ${errorMessage(error)}`);
    }
    this.launched({ managed: true, runtime, proc }, input.avd, runtime.serial);
    this.logger.info("emulator started in its own network namespace", { avd: input.avd, pid: proc.pid, serial: runtime.serial, args: args.join(" ") });
    return this.current();
  }

  private launched(instance: Instance, avd: string, serial: string): void {
    this.instance = instance;
    this.adoptionFailed = false;
    const generation = ++this.generation;
    this.set({ state: "starting", avd, serial, managed: true, isolated: instance.runtime !== null, width: null, height: null, startedAt: nowIso(), error: null });
    const proc = instance.proc;
    if (proc) void proc.exited.then((code) => this.exited(instance, code));
    void this.pollBoot(generation);
  }

  private idle(): EmulatorInfo {
    return this.config.adb && this.config.emulator ? stoppedInfo() : stoppedInfo("unavailable");
  }

  private set(info: EmulatorInfo): void {
    const changed = JSON.stringify(info) !== JSON.stringify(this.info);
    this.info = info;
    if (!changed) return;
    for (const listener of this.listeners) {
      try {
        listener(this.current());
      } catch (error) {
        this.logger.warn("emulator listener failed", { error: errorMessage(error) });
      }
    }
  }

  /** Clears the instance (if still current) and publishes its final state. */
  private finish(instance: Instance, info: EmulatorInfo): void {
    if (this.instance !== instance) return;
    this.instance = null;
    this.set(info);
  }

  private adb(args: string[], serial = this.serial, timeoutMs = COMMAND_TIMEOUT_MS): Promise<RunResult<string>> {
    return run([this.config.adb ?? "adb", "-s", serial, ...args], { env: sdkEnv(this.config), timeoutMs });
  }

  private async deviceState(serial = this.serial): Promise<string | null> {
    if (!this.config.adb) return null;
    const result = await this.adb(["get-state"], serial);
    return result.ok ? result.stdout.trim() : null;
  }

  private async booted(): Promise<boolean> {
    const runtime = this.instance?.runtime;
    if (runtime && (await this.deviceState()) !== "device") await runtime.connectAdb();
    const result = await this.adb(["shell", "getprop", "sys.boot_completed"]);
    return result.ok && result.stdout.trim() === "1";
  }

  private async screenSize(): Promise<{ width: number; height: number } | null> {
    const result = await this.adb(["shell", "wm", "size"]);
    return result.ok ? parseWmSize(result.stdout) : null;
  }

  private async avdName(serial: string): Promise<string | null> {
    const result = await this.adb(["emu", "avd", "name"], serial);
    const name = result.ok ? result.stdout.split("\n")[0]?.trim() : "";
    return name && AVD_NAME_PATTERN.test(name) ? name : null;
  }

  private adoptable(): boolean {
    return !this.launching && !this.instance && (this.info.state === "stopped" || this.info.state === "failed" || this.info.state === "unavailable");
  }

  /** True when an emulator is (now) attached that this daemon did not start. */
  private async adoptIfPresent(): Promise<boolean> {
    if (this.adoptionFailed && this.instance) return true;
    if (!this.adoptable() || !this.config.adb) return false;
    const runtime = await IsolatedRuntime.adopt(this.runtimeOptions());
    if (runtime) {
      if (!this.adoptable()) {
        await runtime.close();
        return false;
      }
      const avd = runtime.avd();
      return this.adopt({ managed: false, runtime, proc: null }, avd && AVD_NAME_PATTERN.test(avd) ? avd : null);
    }
    const serial = emulatorSerial(this.config);
    const state = await this.deviceState(serial);
    if (!state || !ONLINE_STATES.has(state) || !this.adoptable()) return false;
    return this.adopt({ managed: false, runtime: null, proc: null }, await this.avdName(serial));
  }

  private async adopt(instance: Instance, avd: string | null): Promise<boolean> {
    if (!this.adoptable()) {
      await instance.runtime?.close();
      return false;
    }
    this.instance = instance;
    const generation = ++this.generation;
    const isolated = instance.runtime !== null;
    this.set({ state: "starting", avd, serial: this.serial, managed: false, isolated, width: null, height: null, startedAt: nowIso(), error: null });
    this.logger.info("adopted a running emulator", { serial: this.serial, avd, isolated });
    if (!isolated && this.config.isolation === "netns") this.logger.warn("the adopted emulator is not isolated; it will not be linked to the sandbox", { serial: this.serial });
    await this.pollBoot(generation, true);
    return true;
  }

  private async pollBoot(generation: number, once = false): Promise<void> {
    const deadline = Date.now() + this.bootTimeoutMs;
    for (;;) {
      if (generation !== this.generation) return;
      if (await this.booted()) break;
      if (generation !== this.generation) return;
      if (once) {
        once = false;
        void this.pollBoot(generation);
        return;
      }
      if (Date.now() >= deadline) {
        this.bootTimedOut();
        return;
      }
      await Bun.sleep(this.bootPollMs);
    }
    const size = await this.screenSize();
    if (generation !== this.generation) return;
    this.set({ ...this.info, state: "running", width: size?.width ?? null, height: size?.height ?? null, error: null });
    this.logger.info("emulator running", { serial: this.serial, width: size?.width, height: size?.height });
  }

  private bootTimedOut(): void {
    this.logger.warn("emulator did not boot in time", { serial: this.serial });
    const message = `The emulator did not boot within ${Math.round(this.bootTimeoutMs / 60_000) || 1} minutes`;
    if (this.instance?.managed) {
      this.failAfterStop = message;
      this.stop();
      return;
    }
    this.generation += 1;
    this.adoptionFailed = true;
    this.set({ ...this.info, state: "failed", error: message });
  }

  private exitError(code: number | null, log: string[]): string {
    const last = log.findLast((line) => line.trim().length > 0);
    return `The emulator exited${code === null ? "" : ` with code ${code}`}${last ? `: ${last.slice(0, ERROR_LINE_CHARS)}` : ""}`;
  }

  private failedInfo(error: string): EmulatorInfo {
    return { ...stoppedInfo(), state: "failed", avd: this.info.avd, error };
  }

  private exited(instance: Instance, code: number | null): void {
    if (this.instance !== instance) return;
    const requested = this.info.state === "stopping";
    if (instance.runtime) {
      if (requested) return;
      const error = this.exitError(code, this.logs);
      this.generation += 1;
      this.logger.info("emulator exited", { code });
      void instance.runtime.teardown(0).then(() => this.finish(instance, this.failedInfo(error)));
      return;
    }
    this.generation += 1;
    const failure = this.failAfterStop;
    this.failAfterStop = null;
    if (failure) this.finish(instance, this.failedInfo(failure));
    else if (requested) this.finish(instance, stoppedInfo());
    else this.finish(instance, this.failedInfo(this.exitError(code, this.logs)));
    this.logger.info("emulator exited", { code, requested, failure });
  }

  private async teardown(instance: Instance, generation: number): Promise<void> {
    const { runtime, proc } = instance;
    if (runtime) {
      try {
        await runtime.teardown(this.stopGraceMs, proc ? { pid: proc.pid, exited: proc.exited } : null);
      } catch (error) {
        this.logger.warn("emulator teardown failed", { error: errorMessage(error) });
      }
      const failure = this.failAfterStop;
      this.failAfterStop = null;
      this.finish(instance, failure ? this.failedInfo(failure) : stoppedInfo());
      this.logger.info("emulator stopped", { serial: runtime.serial });
    } else if (proc) {
      await terminateGroup(proc.pid, proc.exited, this.stopGraceMs);
    } else {
      await this.killAdopted(instance, generation);
    }
  }

  private async killAdopted(instance: Instance, generation: number): Promise<void> {
    await this.adb(["emu", "kill"]);
    const deadline = Date.now() + this.stopGraceMs;
    while (Date.now() < deadline) {
      if (generation !== this.generation) return;
      if (!ONLINE_STATES.has((await this.deviceState()) ?? "")) {
        if (generation === this.generation) this.finish(instance, stoppedInfo());
        return;
      }
      await Bun.sleep(ADOPTED_STOP_POLL_MS);
    }
    if (generation === this.generation) this.finish(instance, { ...this.info, state: "failed", error: `The emulator on ${this.serial} did not stop` });
  }

  /** Whether an adopted emulator is still there. */
  private async present(instance: Instance): Promise<boolean> {
    if (instance.runtime) return instance.runtime.emulatorAlive();
    return ONLINE_STATES.has((await this.deviceState(emulatorSerial(this.config))) ?? "");
  }

  private async watch(): Promise<void> {
    if (this.watching || this.launching) return;
    this.watching = true;
    try {
      const instance = this.instance;
      const state = this.info.state;
      if (!instance) {
        if (state === "stopped" || state === "failed" || state === "unavailable") await this.adoptIfPresent();
      } else if (!instance.proc && (state === "running" || (state === "failed" && this.adoptionFailed))) {
        const generation = this.generation;
        const present = await this.present(instance);
        if (!present && generation === this.generation && this.instance === instance) {
          this.generation += 1;
          this.adoptionFailed = false;
          if (instance.runtime) await instance.runtime.teardown(0);
          this.finish(instance, { ...this.idle(), error: EMULATOR_MESSAGES.exited });
        } else if (present && instance.runtime && state === "running" && (await this.deviceState()) !== "device") {
          await instance.runtime.connectAdb();
        }
      } else if (instance.runtime && state === "running" && (await this.deviceState()) !== "device") {
        await instance.runtime.connectAdb();
      }
    } catch (error) {
      this.logger.warn("emulator watch failed", { error: errorMessage(error) });
    } finally {
      this.watching = false;
    }
  }
}
