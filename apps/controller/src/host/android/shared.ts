import { emulatorConsolePort, LIMITS, type AndroidDevice, type SharedEmulator } from "@tesseract/protocol";
import { errorMessage } from "../../core/errors";
import type { Logger } from "../../core/logger";
import type { AndroidConfig } from "./config";
import { listAdbDevices } from "./devices";
import type { Endpoint } from "./pipe";

export type SharedEmulatorsOptions = { pollMs?: number };

type Listener = (devices: SharedEmulator[]) => void;

const DEFAULT_POLL_MS = 5_000;

/** The online `emulator-<port>` devices of the host adb, except `exclude` (the emulator the link already tunnels). */
export function shareableEmulators(devices: AndroidDevice[], exclude: string | null): SharedEmulator[] {
  return devices
    .filter((device) => device.state === "device" && device.serial !== exclude && emulatorConsolePort(device.serial) !== null)
    .map((device) => ({ serial: device.serial, model: device.model }))
    .sort((a, b) => (emulatorConsolePort(a.serial) ?? 0) - (emulatorConsolePort(b.serial) ?? 0))
    .slice(0, LIMITS.maxSharedEmulators);
}

const sameDevices = (a: SharedEmulator[], b: SharedEmulator[]) =>
  a.length === b.length && a.every((device, index) => device.serial === b[index]?.serial && device.model === b[index]?.model);

/**
 * Emulators running on the host outside the daemon (Android Studio, `emulator -avd …`) that the link shares
 * with the sandbox when `TESSERACT_ANDROID_SHARE_EMULATORS` is on. Polls `adb devices` while started.
 */
export class SharedEmulators {
  private devices: SharedEmulator[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private readonly listeners = new Set<Listener>();
  private readonly pollMs: number;

  constructor(
    private readonly config: AndroidConfig,
    /** The host serial the link already tunnels as the host emulator, or null. */
    private readonly exclude: () => string | null,
    private readonly logger: Logger,
    options: SharedEmulatorsOptions = {},
  ) {
    this.pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  }

  get enabled(): boolean {
    return this.config.shareEmulators && this.config.adb !== null;
  }

  list(): SharedEmulator[] {
    return this.devices.map((device) => ({ ...device }));
  }

  /** Where a shared emulator's adbd listens on the host (console port + 1), or null when it is not shared now. */
  endpoint(serial: string): Endpoint | null {
    const port = emulatorConsolePort(serial);
    if (port === null || !this.devices.some((device) => device.serial === serial)) return null;
    return { host: "127.0.0.1", port: port + 1 };
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (!this.enabled || this.timer) return;
    this.logger.warn("sharing host emulators with the linked sandbox (TESSERACT_ANDROID_SHARE_EMULATORS); they run on the host network");
    this.timer = setInterval(() => void this.refresh(), this.pollMs);
    await this.refresh();
  }

  /** Re-reads `adb devices`; listeners hear about a changed list. */
  async refresh(): Promise<void> {
    if (!this.enabled || this.polling) return;
    this.polling = true;
    try {
      const next = shareableEmulators(await listAdbDevices(this.config, ""), this.exclude());
      if (sameDevices(next, this.devices)) return;
      this.devices = next;
      this.logger.info("shared host emulators changed", { serials: next.map((device) => device.serial) });
      for (const listener of this.listeners) listener(this.list());
    } catch (error) {
      this.logger.warn("listing host emulators failed", { error: errorMessage(error) });
    } finally {
      this.polling = false;
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
