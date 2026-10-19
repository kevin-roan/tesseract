import { LIMITS, SIM_UDID_PATTERN, type SimState } from "@tesseract/protocol";
import type { IosConfig } from "./config";
import { failure, type CommandRunner } from "./runner";

/** A device line of `simctl list devices --json`. */
export type SimctlDevice = { udid: string; name: string; runtime: string; state: SimState };

/** Screen of a booted device from `idb describe --json`. */
export type ScreenGeometry = { widthPx: number; heightPx: number; widthPt: number; heightPt: number; scale: number };

const COMMAND_TIMEOUT_MS = 60_000;
const INSTALL_TIMEOUT_MS = 10 * 60_000;
const RUNTIME_ID = /SimRuntime\.([A-Za-z]+)-(\d+)-(\d+)(?:-(\d+))?$/;
const XCODE_LINE = /^Xcode\s+\S+/;

const SIMCTL_STATES: Record<string, SimState> = {
  Booted: "booted",
  Booting: "booting",
  Shutdown: "shutdown",
  "Shutting Down": "shutting_down",
};

/** `com.apple.CoreSimulator.SimRuntime.iOS-26-0` → `iOS 26.0`; anything else is kept. */
export function runtimeLabel(id: string): string {
  const match = RUNTIME_ID.exec(id);
  if (!match) return id;
  const [, platform, major, minor, patch] = match;
  return `${platform} ${major}.${minor}${patch ? `.${patch}` : ""}`;
}

export const mapSimState = (state: unknown): SimState => (typeof state === "string" ? (SIMCTL_STATES[state] ?? "unavailable") : "unavailable");

/** Available iOS devices (iPhone and iPad; watchOS, tvOS and visionOS runtimes are left out), sorted by runtime and name. */
export function parseSimctlDevices(output: string): SimctlDevice[] {
  let parsed: { devices?: Record<string, unknown> };
  try {
    parsed = JSON.parse(output) as { devices?: Record<string, unknown> };
  } catch {
    return [];
  }
  const devices: SimctlDevice[] = [];
  for (const [runtimeId, list] of Object.entries(parsed.devices ?? {})) {
    const runtime = runtimeLabel(runtimeId);
    if (!runtime.startsWith("iOS ") || !Array.isArray(list)) continue;
    for (const entry of list as Record<string, unknown>[]) {
      if (entry.isAvailable === false || typeof entry.udid !== "string" || !SIM_UDID_PATTERN.test(entry.udid)) continue;
      devices.push({ udid: entry.udid, name: typeof entry.name === "string" ? entry.name : entry.udid, runtime, state: mapSimState(entry.state) });
    }
  }
  return devices.sort((a, b) => b.runtime.localeCompare(a.runtime, undefined, { numeric: true }) || a.name.localeCompare(b.name));
}

/** `Xcode 26.0\nBuild version 17A324` → `Xcode 26.0`. */
export function parseXcodeVersion(output: string): string | null {
  const line = output.split("\n")[0]?.trim() ?? "";
  return XCODE_LINE.test(line) ? line : null;
}

const positive = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);

/** `screen_dimensions` of `idb describe --json` (spike: field names as in idb 1.1). */
export function parseIdbDescribe(output: string): ScreenGeometry | null {
  let parsed: { screen_dimensions?: Record<string, unknown> };
  try {
    parsed = JSON.parse(output) as { screen_dimensions?: Record<string, unknown> };
  } catch {
    return null;
  }
  const screen = parsed.screen_dimensions ?? {};
  const widthPx = positive(screen.width);
  const heightPx = positive(screen.height);
  const scale = positive(screen.density);
  if (!widthPx || !heightPx || !scale) return null;
  return {
    widthPx,
    heightPx,
    scale,
    widthPt: Math.round(positive(screen.width_points) ?? widthPx / scale),
    heightPt: Math.round(positive(screen.height_points) ?? heightPx / scale),
  };
}

/** `xcrun simctl` behind an injectable runner; every call is a whole command, never a shell. */
export class Simctl {
  constructor(
    private readonly config: IosConfig,
    private readonly runner: CommandRunner,
  ) {}

  private exec(args: string[], timeoutMs = COMMAND_TIMEOUT_MS) {
    if (!this.config.xcrun) throw new Error("xcrun is not installed");
    return this.runner([this.config.xcrun, ...args], { env: this.config.env, timeoutMs });
  }

  private async must(args: string[], what: string, timeoutMs?: number): Promise<string> {
    const result = await this.exec(args, timeoutMs);
    if (!result.ok) throw failure(result, what);
    return result.stdout;
  }

  /** The Xcode version, or null when there is no Xcode with simctl (the Command Line Tools alone have none). */
  async xcode(): Promise<string | null> {
    if (!this.config.xcrun) return null;
    const simctl = await this.exec(["simctl", "help"]);
    if (!simctl.ok) return null;
    const version = await this.exec(["xcodebuild", "-version"]);
    return (version.ok && parseXcodeVersion(version.stdout)) || "Xcode";
  }

  async devices(): Promise<SimctlDevice[]> {
    return parseSimctlDevices(await this.must(["simctl", "list", "devices", "--json"], "simctl list"));
  }

  async boot(udid: string): Promise<void> {
    await this.must(["simctl", "boot", udid], "simctl boot");
  }

  /** Waits until the device finished booting (`simctl bootstatus`). */
  async bootstatus(udid: string, timeoutMs: number = LIMITS.iosBootTimeoutMs): Promise<void> {
    await this.must(["simctl", "bootstatus", udid], "simctl bootstatus", timeoutMs);
  }

  async shutdown(udid: string): Promise<void> {
    await this.must(["simctl", "shutdown", udid], "simctl shutdown");
  }

  async openUrl(udid: string, url: string): Promise<void> {
    await this.must(["simctl", "openurl", udid, url], "simctl openurl");
  }

  async install(udid: string, appPath: string): Promise<void> {
    await this.must(["simctl", "install", udid, appPath], "simctl install", INSTALL_TIMEOUT_MS);
  }

  async installed(udid: string, bundleId: string): Promise<boolean> {
    return (await this.exec(["simctl", "get_app_container", udid, bundleId])).ok;
  }
}
