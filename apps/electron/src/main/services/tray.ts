import { existsSync } from "node:fs";
import { app, Menu, nativeImage, Tray, type NativeImage } from "electron";
import { createLogger } from "../../core/log";
import type { TrayState } from "../../shared/contracts/tray";
import { markQuitting, setHideOnClose } from "../app/lifecycle";
import { platform } from "../context";
import { broadcast } from "../ipc/_framework/events";
import { TRAY_LABELS } from "../labels";
import { getWindow } from "../windows/manager";
import { dispatchCommand, showApp } from "./commands";
import { bundledResource } from "./resources";
import { trayHostAvailable, watchTrayHost } from "./tray-host";
import { trayIconChoices, trayMenuTemplate, togglesOnClick } from "./tray-menu";

const log = createLogger("tray");

let tray: Tray | null = null;
let status = "";
let updateReady: string | null = null;
let installUpdate: () => void = () => undefined;
let hostAvailable = false;
let stopHostWatch: (() => void) | null = null;

function trayIcon(): NativeImage | null {
  for (const choice of trayIconChoices(platform())) {
    const file = bundledResource(...choice.segments);
    if (!existsSync(file)) continue;
    const image = nativeImage.createFromPath(file);
    if (image.isEmpty()) continue;
    const sized = image.getSize().height > choice.size ? image.resize({ height: choice.size, quality: "best" }) : image;
    if (choice.template) sized.setTemplateImage(true);
    return sized;
  }
  return null;
}

async function toggleWindow(): Promise<void> {
  const window = getWindow("main");
  if (window?.isVisible() && !window.isMinimized()) window.hide();
  else await showApp();
}

function rebuildMenu(): void {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate(
      trayMenuTemplate(
        {
          open: () => void showApp(),
          hide: () => getWindow("main")?.hide(),
          command: (command) => void dispatchCommand(command),
          installUpdate: () => installUpdate(),
          quit: () => {
            markQuitting();
            app.quit();
          },
        },
        { updateReady },
      ),
    ),
  );
}

export function trayState(): TrayState {
  return { attached: tray !== null && hostAvailable, tooltip: TRAY_LABELS.tooltip(status) };
}

function publish(): TrayState {
  const state = trayState();
  broadcast("tray", "state", state);
  return state;
}

export function setTrayStatus(label: string): TrayState {
  status = label.trim();
  tray?.setToolTip(TRAY_LABELS.tooltip(status));
  return publish();
}

export function setTrayUpdate(version: string | null, install: () => void): void {
  updateReady = version;
  installUpdate = install;
  rebuildMenu();
}

function headless(): boolean {
  return app.commandLine.getSwitchValue("ozone-platform") === "headless";
}

function applyHost(available: boolean): void {
  hostAvailable = available;
  setHideOnClose(tray !== null && available);
  const window = getWindow("main");
  if (!available && window && !window.isVisible()) void showApp().catch(() => undefined);
  publish();
}

async function followTrayHost(): Promise<void> {
  if (platform() !== "linux") {
    applyHost(true);
    return;
  }
  const available = await trayHostAvailable();
  if (!tray) return;
  applyHost(available);
  stopHostWatch = watchTrayHost(available, (next) => {
    if (tray) applyHost(next);
  });
}

export async function attachTray(): Promise<TrayState> {
  if (tray || headless()) return trayState();
  const image = trayIcon();
  if (!image) {
    log.warn("no tray icon found; running without a tray");
    return trayState();
  }
  try {
    tray = new Tray(image);
  } catch (error) {
    log.warn(`could not create the tray: ${error instanceof Error ? error.message : String(error)}`);
    tray = null;
    return trayState();
  }
  tray.setToolTip(TRAY_LABELS.tooltip(status));
  if (togglesOnClick(platform())) {
    tray.on("click", () => void toggleWindow());
    tray.on("middle-click", () => void toggleWindow());
  }
  rebuildMenu();
  await followTrayHost();
  if (!hostAvailable) log.warn("no StatusNotifier host is running; closing the window quits the app");
  return trayState();
}

export function detachTray(): void {
  stopHostWatch?.();
  stopHostWatch = null;
  hostAvailable = false;
  setHideOnClose(false);
  tray?.destroy();
  tray = null;
}
