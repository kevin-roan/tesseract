import { existsSync } from "node:fs";
import { UI_PREFIX, type DisplayStatus } from "@theone/protocol";
import { unavailable } from "../core/errors";
import { run, runBytes } from "../core/exec";
import { probeRfb } from "../core/net";
import type { Config } from "../config";

const XDPYINFO_TIMEOUT_MS = 3_000;
const SCREENSHOT_TIMEOUT_MS = 15_000;
const VNC_PROBE_TIMEOUT_MS = 1_000;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const VNC_WEB_PATH = `${UI_PREFIX}/vnc` as const;

export function parseDimensions(xdpyinfo: string): { width: number; height: number } | null {
  const match = /dimensions:\s+(\d+)x(\d+)\s+pixels/.exec(xdpyinfo);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function x11Socket(display: string): string | null {
  const match = /^:(\d+)(?:\.\d+)?$/.exec(display);
  return match ? `/tmp/.X11-unix/X${match[1]}` : null;
}

const isPng = (bytes: Uint8Array) => PNG_MAGIC.every((byte, index) => bytes[index] === byte);

export class DisplayService {
  private cached: { at: number; value: DisplayStatus } | null = null;

  constructor(
    private readonly config: Config,
    private readonly cacheMs = 2_000,
  ) {}

  async status(): Promise<DisplayStatus> {
    if (this.cached && Date.now() - this.cached.at < this.cacheMs) return this.cached.value;
    const [screen, vnc] = await Promise.all([
      this.probeDisplay(),
      probeRfb(this.config.vncHost, this.config.vncPort, VNC_PROBE_TIMEOUT_MS),
    ]);
    const value: DisplayStatus = {
      display: this.config.display,
      available: screen.available,
      width: screen.size?.width ?? null,
      height: screen.size?.height ?? null,
      vnc: { available: vnc, port: this.config.vncPort, password: this.config.vncPassword },
      webPath: VNC_WEB_PATH,
    };
    this.cached = { at: Date.now(), value };
    return value;
  }

  async screenshot(): Promise<Uint8Array> {
    const status = await this.status();
    if (!status.available) throw unavailable(`Display ${this.config.display} is not available`);
    const display = this.config.display;
    const primary = await runBytes(["import", "-window", "root", "-display", display, "png:-"], {
      timeoutMs: SCREENSHOT_TIMEOUT_MS,
    });
    if (primary.ok && isPng(primary.stdout)) return primary.stdout;
    const fallback = await runBytes(
      ["bash", "-c", 'set -o pipefail; xwd -root -silent -display "$1" | convert xwd:- png:-', "screenshot", display],
      { timeoutMs: SCREENSHOT_TIMEOUT_MS },
    );
    if (fallback.ok && isPng(fallback.stdout)) return fallback.stdout;
    const reason = (primary.stderr || primary.error || fallback.stderr || fallback.error || "unknown error").trim();
    throw unavailable(`Screenshot of ${display} failed: ${reason.split("\n")[0]}`);
  }

  private async probeDisplay(): Promise<{ available: boolean; size: { width: number; height: number } | null }> {
    const socket = x11Socket(this.config.display);
    if (socket && !existsSync(socket)) return { available: false, size: null };
    const result = await run(["xdpyinfo", "-display", this.config.display], { timeoutMs: XDPYINFO_TIMEOUT_MS });
    if (!result.ok) return { available: false, size: null };
    return { available: true, size: parseDimensions(result.stdout) };
  }
}
