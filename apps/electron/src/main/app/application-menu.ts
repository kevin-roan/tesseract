import { app, BrowserWindow, Menu } from "electron";
import { createLogger } from "../../core/log";
import { platform } from "../context";
import { cliStatus, installCli } from "../services/cli-install";
import { dispatchCommand } from "../services/commands";
import { checkForUpdates, updateState } from "../services/updater";
import { markQuitting } from "./lifecycle";
import { isDevToolsShortcut, macMenuTemplate } from "./menu";
import { zoomWindow } from "./zoom";

const log = createLogger("menu");

function focused(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow();
}

function report(error: unknown): void {
  log.warn(error instanceof Error ? error.message : String(error));
}

export function installApplicationMenu(): void {
  if (platform() !== "darwin") {
    Menu.setApplicationMenu(null);
    if (!app.isPackaged) {
      app.on("browser-window-created", (_event, window) => {
        window.webContents.on("before-input-event", (event, input) => {
          if (!isDevToolsShortcut(input)) return;
          event.preventDefault();
          window.webContents.toggleDevTools();
        });
      });
    }
    return;
  }
  const template = macMenuTemplate(
    {
      command: (command) => void dispatchCommand(command).catch(report),
      zoom: (direction) => {
        const window = focused();
        if (window) void zoomWindow(window, direction).catch(report);
      },
      installCli: () => void installCli().then(installApplicationMenu, report),
      checkForUpdates: () => void checkForUpdates().catch(report),
      closeWindow: () => focused()?.close(),
      quit: () => {
        markQuitting();
        app.quit();
      },
    },
    {
      devTools: !app.isPackaged,
      updates: updateState().kind !== "unsupported",
      installCli: cliStatus().state === "missing",
    },
  );
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
