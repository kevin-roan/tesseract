import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app, BrowserWindow, screen } from "electron";
import type { DeviceWindowKind, DeviceWindowSize } from "../../shared/device-window";
import { IpcError } from "../../shared/ipc-types";
import { ROUTE } from "../../shared/routes";
import { APP_NAME } from "../../shared/runtime";
import { IPC_LABELS, WINDOW_LABELS } from "../labels";
import { trackRendererLoad } from "../services/idle";
import { DEVICE_WINDOW, TRANSPARENT_BACKGROUND } from "./config";
import { fitDeviceWindow } from "./device-fit";
import { baseWindowOptions, focusWindow, getWindow, loadRoute } from "./manager";

const PNG_DATA_URL = "data:image/png;base64,";

const windows = new Map<DeviceWindowKind, BrowserWindow>();

export function isDeviceWindow(window: BrowserWindow | null | undefined): boolean {
  return window !== null && window !== undefined && [...windows.values()].includes(window);
}

export async function createDeviceWindow(kind: DeviceWindowKind): Promise<BrowserWindow> {
  const existing = windows.get(kind);
  if (existing && !existing.isDestroyed()) {
    focusWindow(existing);
    return existing;
  }
  const parent = getWindow("main");
  const window = new BrowserWindow({
    ...baseWindowOptions("device"),
    ...DEVICE_WINDOW,
    title: WINDOW_LABELS.device[kind],
    titleBarStyle: "default",
    trafficLightPosition: undefined,
    transparent: true,
    backgroundColor: TRANSPARENT_BACKGROUND,
    maximizable: false,
    fullscreenable: false,
    parent: parent?.isVisible() ? parent : undefined,
  });
  windows.set(kind, window);
  trackRendererLoad(window.webContents);
  window.on("closed", () => {
    if (windows.get(kind) === window) windows.delete(kind);
  });
  window.once("ready-to-show", () => window.show());
  await loadRoute(window, ROUTE.device(kind));
  return window;
}

export function fitDevice(window: BrowserWindow, size: DeviceWindowSize): void {
  if (!isDeviceWindow(window)) throw new IpcError("forbidden", IPC_LABELS.notDeviceWindow);
  if (!(size?.width > 0 && size.height > 0)) throw new IpcError("invalid_argument", IPC_LABELS.invalidDeviceSize);
  const { size: fitted, chrome } = fitDeviceWindow(size, screen.getDisplayMatching(window.getBounds()).workAreaSize);
  window.setAspectRatio(size.width / size.height, chrome);
  window.setContentSize(fitted.width, fitted.height);
}

export async function saveDeviceScreenshot(png: unknown): Promise<string> {
  if (typeof png !== "string" || !png.startsWith(PNG_DATA_URL)) throw new IpcError("invalid_argument", IPC_LABELS.invalidScreenshot);
  const directory = app.getPath("pictures");
  await mkdir(directory, { recursive: true });
  const file = join(directory, `${APP_NAME} ${new Date().toISOString().replace(/[:.]/g, "-")}.png`);
  await writeFile(file, Buffer.from(png.slice(PNG_DATA_URL.length), "base64"));
  return file;
}
