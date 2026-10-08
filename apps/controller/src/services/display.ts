import { existsSync } from "node:fs";
import { UI_PREFIX, type DisplayStatus, type DisplayWindow, type DisplayWindowList } from "@tesseract/protocol";
import { badRequest, notFound, unavailable } from "../core/errors";
import { childEnv, run, runBytes } from "../core/exec";
import { probeRfb } from "../core/net";
import type { Config } from "../config";
import { isTaskWindow, parseActiveWindow, parseWindowProps, parseWmctrlList, sameWindowId, toDisplayWindow } from "./display-windows";

const XDPYINFO_TIMEOUT_MS = 3_000;
const SCREENSHOT_TIMEOUT_MS = 15_000;
const VNC_PROBE_TIMEOUT_MS = 1_000;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const VNC_WEB_PATH = `${UI_PREFIX}/vnc` as const;
const WINDOW_TOOL_TIMEOUT_MS = 3_000;
const WINDOW_ID = /^0x[0-9a-f]+$/;

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

  /** Application windows, oldest first (docks, panels and menus are left out). */
  async windows(): Promise<DisplayWindowList> {
    await this.requireDisplay();
    const [list, root] = await Promise.all([
      this.windowTool(["wmctrl", "-lp"]),
      this.windowTool(["xprop", "-root", "_NET_ACTIVE_WINDOW"]),
    ]);
    const active = parseActiveWindow(root);
    const rows = parseWmctrlList(list);
    const windows = await Promise.all(
      rows.map(async (row): Promise<DisplayWindow | null> => {
        const props = await run(["xprop", "-id", row.id, "WM_CLASS", "_NET_WM_WINDOW_TYPE", "_NET_WM_STATE"], this.windowRunOptions());
        // The window can close between the two calls; a failed xprop just drops it.
        if (!props.ok) return null;
        const parsed = parseWindowProps(props.stdout);
        return isTaskWindow(parsed) ? toDisplayWindow(row, parsed, active) : null;
      }),
    );
    return { windows: windows.filter((window) => window !== null) };
  }

  /** Raises and focuses a window, switching desktop and restoring it when minimized. */
  async activateWindow(id: string): Promise<void> {
    const window = await this.findWindow(id);
    await this.windowTool(["wmctrl", "-ia", window.id]);
  }

  /** Asks a window to close (WM_DELETE_WINDOW); `force` disconnects its client from the X server instead. */
  async closeWindow(id: string, force = false): Promise<void> {
    const window = await this.findWindow(id);
    await this.windowTool(force ? ["xdotool", "windowkill", window.id] : ["wmctrl", "-ic", window.id]);
  }

  private async findWindow(id: string): Promise<DisplayWindow> {
    if (!WINDOW_ID.test(id)) throw badRequest(`Invalid window id ${id.slice(0, 40)}: expected a hex id like 0x03a00004`);
    const { windows } = await this.windows();
    const window = windows.find((candidate) => sameWindowId(candidate.id, id));
    if (!window) throw notFound(`Window ${id} not found`);
    return window;
  }

  private async requireDisplay(): Promise<void> {
    const status = await this.status();
    if (!status.available) throw unavailable(`Display ${this.config.display} is not available`);
  }

  private windowRunOptions() {
    return { env: { ...childEnv(), DISPLAY: this.config.display }, timeoutMs: WINDOW_TOOL_TIMEOUT_MS };
  }

  private async windowTool(cmd: string[]): Promise<string> {
    const result = await run(cmd, this.windowRunOptions());
    if (result.ok) return result.stdout;
    const reason = (result.stderr || result.error || (result.timedOut ? "timed out" : `exit ${result.code}`)).trim();
    throw unavailable(`${cmd[0]} failed: ${reason.split("\n")[0]}`);
  }

  private async probeDisplay(): Promise<{ available: boolean; size: { width: number; height: number } | null }> {
    const socket = x11Socket(this.config.display);
    if (socket && !existsSync(socket)) return { available: false, size: null };
    const result = await run(["xdpyinfo", "-display", this.config.display], { timeoutMs: XDPYINFO_TIMEOUT_MS });
    if (!result.ok) return { available: false, size: null };
    return { available: true, size: parseDimensions(result.stdout) };
  }
}
