import { app, BrowserWindow, nativeTheme } from "electron";
import { stepZoom } from "../../core/config";
import type { WindowState } from "../../shared/contracts/window";
import { IpcError } from "../../shared/ipc-types";
import { eventChannel } from "../../shared/ipc";
import { defineService, type HandlerContext } from "./_framework/define";
import { updateSettings } from "../services/settings";
import { createMainWindow, createOnboardingWindow, focusWindow, getWindow } from "../windows/manager";

function windowOf(context: HandlerContext): BrowserWindow {
  if (!context.window) throw new IpcError("unavailable", "The sender has no window");
  return context.window;
}

export function windowState(window: BrowserWindow): WindowState {
  return {
    maximized: window.isMaximized(),
    fullscreen: window.isFullScreen(),
    focused: window.isFocused(),
    visible: window.isVisible(),
    zoom: window.webContents.getZoomFactor(),
    systemDark: nativeTheme.shouldUseDarkColors,
  };
}

function emitState(window: BrowserWindow): void {
  if (!window.isDestroyed()) window.webContents.send(eventChannel("window", "state"), windowState(window));
}

const WATCHED_EVENTS = ["maximize", "unmaximize", "enter-full-screen", "leave-full-screen", "focus", "blur", "show", "hide"] as const;

export default defineService(
  "window",
  {
    state: (context) => windowState(windowOf(context)),
    minimize: (context) => windowOf(context).minimize(),
    toggleMaximize: (context) => {
      const window = windowOf(context);
      if (window.isMaximized()) window.unmaximize();
      else window.maximize();
      return windowState(window);
    },
    close: (context) => windowOf(context).close(),
    setFullscreen: (context, on) => {
      const window = windowOf(context);
      window.setFullScreen(on);
      return windowState(window);
    },
    zoom: async (context, direction) => {
      const window = windowOf(context);
      const zoom = stepZoom(window.webContents.getZoomFactor(), direction);
      window.webContents.setZoomFactor(zoom);
      await updateSettings({ zoom });
      emitState(window);
      return zoom;
    },
    openOnboarding: async (_context, step) => {
      await createOnboardingWindow(step);
    },
    setAccelGuard: (context, active) => {
      windowOf(context).webContents.setIgnoreMenuShortcuts(active === true);
    },
    openMain: async (context) => {
      focusWindow(await createMainWindow());
      if (context.window && context.window === getWindow("onboarding")) context.window.close();
    },
  },
  {
    start: () => {
      const attach = (_event: unknown, window: BrowserWindow) => {
        for (const name of WATCHED_EVENTS) window.on(name as "focus", () => emitState(window));
      };
      app.on("browser-window-created", attach);
      const onTheme = () => {
        for (const window of BrowserWindow.getAllWindows()) emitState(window);
      };
      nativeTheme.on("updated", onTheme);
      return () => {
        app.off("browser-window-created", attach);
        nativeTheme.off("updated", onTheme);
      };
    },
  },
);
