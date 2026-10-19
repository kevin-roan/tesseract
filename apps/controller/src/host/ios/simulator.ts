import { DEFAULT_STOP_SIGNAL, LIMITS, type IosUnavailableCode, type SimDevice, type StopSignal } from "@tesseract/protocol";
import { conflict, errorMessage, notFound, unavailable } from "../../core/errors";
import type { Logger } from "../../core/logger";
import type { IosConfig } from "./config";
import { defaultRunner, type CommandRunner } from "./runner";
import { Simctl, type ScreenGeometry, type SimctlDevice } from "./simctl";

export type SimulatorOptions = {
  runner?: CommandRunner;
  bootTimeoutMs?: number;
  /** How often the booted device is re-read for the link; 0 disables it. */
  watchMs?: number;
  /** Reads the screen geometry of a booted device (from the screen session's idb); null when unknown. */
  geometry?: (udid: string) => ScreenGeometry | null;
};

export type Availability = { available: boolean; reasonCode: IosUnavailableCode | null; reason: string | null; xcode: string | null };

type Listener = (booted: SimDevice | null) => void;

export const SIMULATOR_MESSAGES = {
  disabled: "iOS Simulator support is off; start the host daemon with TESSERACT_IOS=1",
  notMacos: "The iOS Simulator needs a macOS host with Xcode",
  noXcode: "Xcode with the iOS Simulator is not installed; install Xcode and run sudo xcode-select -s /Applications/Xcode.app",
  noIdb: "idb is not installed on the host; brew install facebook/fb/idb-companion and pip3 install fb-idb (or set TESSERACT_IDB, TESSERACT_IDB_COMPANION)",
  notShutdown: (name: string, state: string) => `${name} is ${state.replace("_", " ")}; it can only be booted when shut down`,
  noneBooted: "No simulator is booted",
  bootTimeout: "The simulator did not finish booting",
} as const;

const DEFAULT_WATCH_MS = 5_000;
const PS_LINE = /^\s*(\d+)\s+(.*)$/;
const DEVICE_PROCESS = /(launchd_sim|idb_companion)/;

/** Pids of `ps -axo pid=,command=` lines that belong to the device (`launchd_sim …/Devices/<udid>/…`, `idb_companion --udid <udid>`). */
export function parseDevicePids(output: string, udid: string): number[] {
  const pids: number[] = [];
  const needle = udid.toUpperCase();
  for (const line of output.split("\n")) {
    const match = PS_LINE.exec(line);
    const command = match?.[2] ?? "";
    if (match && DEVICE_PROCESS.test(command) && command.toUpperCase().includes(needle)) pids.push(Number(match[1]));
  }
  return pids;
}

/**
 * The host's iOS Simulator devices through `xcrun simctl`: boot (`simctl boot` then `simctl bootstatus`), shutdown,
 * and which device is "the" booted one (the one this daemon booted, else the first booted one).
 */
export class IosSimulators {
  readonly simctl: Simctl;
  private readonly runner: CommandRunner;
  private readonly bootTimeoutMs: number;
  private readonly watchMs: number;
  private readonly listeners = new Set<Listener>();
  private readonly errors = new Map<string, string>();
  private readonly booting = new Set<string>();
  private readonly stopping = new Set<string>();
  private preferred: string | null = null;
  private xcode: string | null | undefined;
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private lastKey = "";

  constructor(
    private readonly config: IosConfig,
    private readonly logger: Logger,
    private readonly options: SimulatorOptions = {},
  ) {
    this.runner = options.runner ?? defaultRunner;
    this.simctl = new Simctl(config, this.runner);
    this.bootTimeoutMs = options.bootTimeoutMs ?? LIMITS.iosBootTimeoutMs;
    this.watchMs = options.watchMs ?? DEFAULT_WATCH_MS;
  }

  /** Xcode is probed until it is found (once found, it is kept for this daemon run). */
  async availability(): Promise<Availability> {
    const off = (reasonCode: IosUnavailableCode, reason: string, xcode: string | null = null): Availability => ({ available: false, reasonCode, reason, xcode });
    if (!this.config.enabled) return off("disabled", SIMULATOR_MESSAGES.disabled);
    if (this.config.platform !== "darwin") return off("not_macos", SIMULATOR_MESSAGES.notMacos);
    if (!this.xcode) this.xcode = await this.simctl.xcode().catch(() => null);
    if (!this.xcode) return off("no_xcode", SIMULATOR_MESSAGES.noXcode);
    if (!this.config.idb || !this.config.idbCompanion) return off("no_idb", SIMULATOR_MESSAGES.noIdb, this.xcode);
    return { available: true, reasonCode: null, reason: null, xcode: this.xcode };
  }

  async unavailableReason(): Promise<string | null> {
    return (await this.availability()).reason;
  }

  start(): void {
    if (this.watchMs <= 0 || !this.config.enabled || this.config.platform !== "darwin") return;
    this.watchTimer = setInterval(() => void this.refresh(), this.watchMs);
    this.watchTimer.unref?.();
  }

  stop(): void {
    if (this.watchTimer) clearInterval(this.watchTimer);
    this.watchTimer = null;
    this.listeners.clear();
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Every device with the daemon's view of it; `[]` when not available. */
  async list(): Promise<SimDevice[]> {
    if (!(await this.availability()).available) return [];
    let devices: SimctlDevice[];
    try {
      devices = await this.simctl.devices();
    } catch (error) {
      this.logger.warn("simctl list failed", { error: errorMessage(error) });
      return [];
    }
    return devices.map((device) => this.view(device));
  }

  booted(devices: SimDevice[]): SimDevice | null {
    const live = devices.filter((device) => device.state === "booted" || device.state === "booting" || device.state === "shutting_down");
    return live.find((device) => device.udid === this.preferred) ?? live.find((device) => device.state === "booted") ?? live[0] ?? null;
  }

  /** The booted device, or the given one when it is booted. */
  async target(udid?: string): Promise<SimDevice | null> {
    const devices = await this.list();
    if (udid) return devices.find((device) => device.udid === udid && device.state === "booted") ?? null;
    const booted = this.booted(devices);
    return booted?.state === "booted" ? booted : null;
  }

  private view(device: SimctlDevice): SimDevice {
    let state = device.state;
    if (this.booting.has(device.udid) && state !== "booted") state = "booting";
    if (this.stopping.has(device.udid) && state !== "shutdown") state = "shutting_down";
    const error = this.errors.get(device.udid) ?? null;
    if (error && state === "shutdown") state = "failed";
    const geometry = state === "booted" ? (this.options.geometry?.(device.udid) ?? null) : null;
    return {
      udid: device.udid,
      name: device.name,
      runtime: device.runtime,
      state,
      widthPt: geometry?.widthPt ?? null,
      heightPt: geometry?.heightPt ?? null,
      scale: geometry?.scale ?? null,
      error,
    };
  }

  private async require(udid?: string): Promise<SimDevice> {
    const availability = await this.availability();
    if (!availability.available) throw unavailable(availability.reason ?? SIMULATOR_MESSAGES.disabled);
    const devices = await this.list();
    const device = udid ? devices.find((entry) => entry.udid === udid) : this.booted(devices);
    if (!device) throw udid ? notFound(`Simulator ${udid} not found`) : conflict(SIMULATOR_MESSAGES.noneBooted);
    return device;
  }

  /** `202` at once with `booting`; `simctl bootstatus` decides between `booted` and `failed`. */
  async boot(udid: string): Promise<SimDevice> {
    const device = await this.require(udid);
    if (device.state !== "shutdown" && device.state !== "failed") throw conflict(SIMULATOR_MESSAGES.notShutdown(device.name, device.state));
    this.errors.delete(udid);
    this.booting.add(udid);
    this.preferred = udid;
    void this.runBoot(udid);
    return { ...device, state: "booting", error: null };
  }

  private async runBoot(udid: string): Promise<void> {
    try {
      await this.simctl.boot(udid);
      await this.simctl.bootstatus(udid, this.bootTimeoutMs);
      this.logger.info("simulator booted", { udid });
    } catch (error) {
      const message = errorMessage(error);
      this.errors.set(udid, message.includes("timed out") ? SIMULATOR_MESSAGES.bootTimeout : message);
      this.logger.warn("simulator boot failed", { udid, error: message });
    } finally {
      this.booting.delete(udid);
      await this.refresh();
    }
  }

  /**
   * Shuts the booted device down. `SIGKILL` first kills its `launchd_sim` and `idb_companion` processes (found with
   * `ps`), then runs `simctl shutdown`. `beforeShutdown` ends its screen sessions.
   */
  async shutdown(signal: StopSignal = DEFAULT_STOP_SIGNAL, beforeShutdown: (udid: string, kill: boolean) => Promise<void> = async () => {}): Promise<SimDevice> {
    const device = await this.require();
    const kill = signal === "SIGKILL";
    this.stopping.add(device.udid);
    if (this.preferred === device.udid) this.preferred = null;
    void this.runShutdown(device.udid, kill, beforeShutdown);
    return { ...device, state: "shutting_down" };
  }

  private async runShutdown(udid: string, kill: boolean, beforeShutdown: (udid: string, kill: boolean) => Promise<void>): Promise<void> {
    try {
      await beforeShutdown(udid, kill);
      if (kill) await this.killDevice(udid);
      await this.simctl.shutdown(udid);
      this.logger.info("simulator shut down", { udid, signal: kill ? "SIGKILL" : "SIGTERM" });
    } catch (error) {
      this.logger.warn("simulator shutdown failed", { udid, error: errorMessage(error) });
    } finally {
      this.stopping.delete(udid);
      this.errors.delete(udid);
      await this.refresh();
    }
  }

  private async killDevice(udid: string): Promise<void> {
    const result = await this.runner(["ps", "-axo", "pid=,command="], { env: this.config.env, timeoutMs: 10_000 });
    if (!result.ok) return;
    for (const pid of parseDevicePids(result.stdout, udid)) {
      if (pid === process.pid) continue;
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
  }

  /** Tells the listeners when the booted device (or its state) changed. */
  async refresh(): Promise<void> {
    const booted = this.booted(await this.list());
    const key = booted ? `${booted.udid}:${booted.state}:${booted.widthPt}` : "";
    if (key === this.lastKey) return;
    this.lastKey = key;
    for (const listener of this.listeners) listener(booted);
  }
}
