import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import type { EmulatorState } from "../../shared/contracts/android";
import { IpcError } from "../../shared/ipc-types";
import { currentPathEnvironment, type PathEnvironment } from "../paths";
import { runCommand, scrubEnv } from "../process";
import {
  ADB_TIMEOUT_MS,
  BOOT_POLL_MS,
  BOOT_TIMEOUT_MS,
  EMULATOR_PORT_RANGE,
  EMULATOR_STOP_GRACE_MS,
  EMU_KILL_ARGS,
  LOOPBACK,
  SCRUBBED_ENV_PREFIXES,
  TASKKILL,
} from "./constants";
import { ANDROID_LABELS } from "./labels";
import { adbBinary, emulatorBinary, exists, sdkEnv } from "./sdk";

const LABELS = ANDROID_LABELS.emulator;
const LAST_LINES = 20;
const FAILURE_PREFIX = /^(?:ERROR|PANIC|FATAL)\s*[|:]\s*/;

export interface EmulatorStartOptions {
  headless?: boolean;
  gpu?: string;
  port?: number;
  extraArgs?: string[];
}

export interface EmulatorControllerOptions {
  paths?: PathEnvironment;
  onLog?(line: string): void;
  bootPollMs?: number;
  bootTimeoutMs?: number;
  stopGraceMs?: number;
  isPortFree?(port: number): Promise<boolean>;
}

export function isPortFree(port: number, host = LOOPBACK): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

export async function findConsolePort(check: (port: number) => Promise<boolean> = isPortFree): Promise<number | null> {
  for (let port = EMULATOR_PORT_RANGE.first; port <= EMULATOR_PORT_RANGE.last; port += 2) {
    if ((await check(port)) && (await check(port + 1))) return port;
  }
  return null;
}

export function failureLine(lines: readonly string[]): string | null {
  const meaningful = lines.map((line) => line.trim()).filter(Boolean);
  const failure = meaningful.filter((line) => FAILURE_PREFIX.test(line)).at(-1) ?? meaningful.at(-1) ?? null;
  return failure ? failure.replace(FAILURE_PREFIX, "") : null;
}

export function emulatorArgs(avd: string, port: number, options: EmulatorStartOptions = {}): string[] {
  const args = ["-avd", avd, "-port", String(port), "-no-audio", "-no-boot-anim"];
  if (options.headless) args.push("-no-window");
  if (options.gpu) args.push("-gpu", options.gpu);
  return [...args, ...(options.extraArgs ?? [])];
}

interface EmulatorTarget {
  sdkRoot: string;
  serial: string;
}

function alive(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null;
}

function exitedWithin(exited: Promise<void>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([exited.then(() => true), timeout]).finally(() => clearTimeout(timer));
}

export class EmulatorController {
  private current: EmulatorState = { kind: "stopped" };
  private child: ChildProcess | null = null;
  private target: EmulatorTarget | null = null;
  private stopping = false;
  private poll: ReturnType<typeof setTimeout> | null = null;
  private lastLines: string[] = [];
  private readonly options: EmulatorControllerOptions;

  constructor(
    private readonly onChange: (state: EmulatorState) => void = () => undefined,
    options: EmulatorControllerOptions = {},
  ) {
    this.options = options;
  }

  state(): EmulatorState {
    return this.current;
  }

  runningAvd(): string | null {
    return this.current.kind === "starting" || this.current.kind === "running" || this.current.kind === "stopping" ? this.current.avd : null;
  }

  private paths(): PathEnvironment {
    return this.options.paths ?? currentPathEnvironment();
  }

  private log(line: string): void {
    this.lastLines.push(line);
    if (this.lastLines.length > LAST_LINES) this.lastLines.shift();
    this.options.onLog?.(line);
  }

  async start(sdkRoot: string, avd: string, startOptions: EmulatorStartOptions = {}): Promise<EmulatorState> {
    if (this.child) throw new IpcError("unavailable", LABELS.running);
    const paths = this.paths();
    const binary = emulatorBinary(sdkRoot, paths.platform);
    if (!(await exists(binary))) throw new IpcError("not_found", LABELS.notInstalled(sdkRoot));
    const port = startOptions.port ?? (await findConsolePort(this.options.isPortFree));
    if (port === null) throw new IpcError("unavailable", LABELS.noPort);
    const env = sdkEnv(sdkRoot, scrubEnv(paths.env as NodeJS.ProcessEnv, SCRUBBED_ENV_PREFIXES));
    this.lastLines = [];
    this.stopping = false;
    const child = spawn(binary, emulatorArgs(avd, port, startOptions), { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    this.child = child;
    this.log(LABELS.started(avd, port));
    for (const stream of [child.stdout, child.stderr]) {
      if (stream) createInterface({ input: stream }).on("line", (line) => this.log(line));
    }
    child.once("error", (error) => this.onExit(child, null, error.message));
    child.once("exit", (code) => this.onExit(child, code, null));
    const serial = `emulator-${port}`;
    this.target = { sdkRoot, serial };
    this.set({ kind: "starting", avd, since: Date.now() });
    this.scheduleBootPoll(child, sdkRoot, avd, serial, Date.now());
    return this.current;
  }

  private scheduleBootPoll(child: ChildProcess, sdkRoot: string, avd: string, serial: string, startedAt: number): void {
    this.poll = setTimeout(async () => {
      this.poll = null;
      if (this.child !== child || this.current.kind !== "starting") return;
      if (Date.now() - startedAt > (this.options.bootTimeoutMs ?? BOOT_TIMEOUT_MS)) {
        this.set({ kind: "failed", message: LABELS.bootTimeout });
        void this.terminate(child);
        return;
      }
      if (await this.booted(sdkRoot, serial)) {
        if (this.child !== child || this.current.kind !== "starting") return;
        this.log(LABELS.booted(avd, serial));
        this.set({ kind: "running", avd, serial });
        return;
      }
      this.scheduleBootPoll(child, sdkRoot, avd, serial, startedAt);
    }, this.options.bootPollMs ?? BOOT_POLL_MS);
  }

  private async adb(sdkRoot: string, serial: string, args: readonly string[]) {
    const paths = this.paths();
    const bundled = adbBinary(sdkRoot, paths.platform);
    const adb = (await exists(bundled)) ? bundled : "adb";
    return runCommand(adb, ["-s", serial, ...args], {
      timeoutMs: ADB_TIMEOUT_MS,
      env: sdkEnv(sdkRoot, paths.env as NodeJS.ProcessEnv),
    });
  }

  private async booted(sdkRoot: string, serial: string): Promise<boolean> {
    const result = await this.adb(sdkRoot, serial, ["shell", "getprop", "sys.boot_completed"]);
    return result.code === 0 && result.stdout.trim() === "1";
  }

  private onExit(child: ChildProcess, code: number | null, error: string | null): void {
    if (this.child !== child) return;
    this.child = null;
    this.target = null;
    if (this.poll) clearTimeout(this.poll);
    this.poll = null;
    if (this.stopping || (code === 0 && this.current.kind !== "starting")) {
      this.set({ kind: "stopped" });
      return;
    }
    if (this.current.kind === "failed") return;
    const line = error ?? failureLine(this.lastLines);
    this.set({ kind: "failed", message: LABELS.exited(code, line) });
  }

  private async terminate(child: ChildProcess): Promise<void> {
    if (!alive(child)) return;
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    const grace = this.options.stopGraceMs ?? EMULATOR_STOP_GRACE_MS;
    const target = this.target;
    if (target) {
      const killed = await this.adb(target.sdkRoot, target.serial, EMU_KILL_ARGS).catch(() => null);
      if (killed?.code === 0 && (await exitedWithin(exited, grace))) return;
    }
    if (!alive(child)) return;
    if (this.paths().platform === "win32" && child.pid !== undefined) {
      await runCommand(TASKKILL, ["/pid", String(child.pid), "/t", "/f"], { timeoutMs: ADB_TIMEOUT_MS }).catch(() => null);
    } else {
      child.kill("SIGTERM");
    }
    if (await exitedWithin(exited, grace)) return;
    if (alive(child)) child.kill("SIGKILL");
    await exited;
  }

  async stop(): Promise<EmulatorState> {
    const child = this.child;
    if (!child) {
      if (this.current.kind !== "stopped") this.set({ kind: "stopped" });
      return this.current;
    }
    const avd = this.runningAvd() ?? "";
    this.stopping = true;
    this.set({ kind: "stopping", avd });
    await this.terminate(child);
    return this.current;
  }

  protected set(state: EmulatorState): void {
    this.current = state;
    this.onChange(state);
  }
}
