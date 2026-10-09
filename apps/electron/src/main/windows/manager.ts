import { existsSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, nativeTheme, type BrowserWindowConstructorOptions } from "electron";
import { encodeRuntimeArg, ENV, type Scheme, type WindowKind } from "../../shared/runtime";
import { DEFAULT_PAGE, ROUTE, type OnboardingStepId } from "../../shared/routes";
import { markQuitting, shouldHideOnClose } from "../app/lifecycle";
import { WINDOW_ICON } from "../constants";
import { WINDOW_LABELS } from "../labels";
import { mainContext, platform } from "../context";
import { trackRendererLoad } from "../services/idle";
import { bundledResource } from "../services/resources";
import { currentSettings } from "../services/settings";
import { HOST_TERMINAL_WINDOW, MAIN_WINDOW, ONBOARDING_WINDOW, PRELOAD_FILE, TRAFFIC_LIGHT_POSITION, WINDOW_BACKGROUND } from "./config";
import { rendererEntryFile } from "./entry";
import { persistWindowState, restoredMainWindow } from "./window-state-store";

const windows = new Map<WindowKind, BrowserWindow>();

export function activeScheme(): Scheme {
  const context = mainContext();
  const appearance = context.appearanceOverride ?? currentSettings().appearance;
  const dark = appearance === "system" ? nativeTheme.shouldUseDarkColors : appearance === "dark";
  return dark ? "graphite" : "graphiteLight";
}

function runtimeArgument(kind: WindowKind): string {
  const context = mainContext();
  return encodeRuntimeArg({
    platform: platform(),
    arch: process.arch,
    version: app.getVersion(),
    windowKind: kind,
    fixtures: context.fixtures,
    snapshot: context.args.snapshot !== null,
    appearanceOverride: context.appearanceOverride,
    reducedMotion: context.args.snapshot !== null,
  });
}

function windowIcon(): string | undefined {
  if (platform() === "darwin") return undefined;
  const file = bundledResource(...WINDOW_ICON);
  return existsSync(file) ? file : undefined;
}

export function baseWindowOptions(kind: WindowKind): BrowserWindowConstructorOptions {
  const mac = platform() === "darwin";
  return {
    show: false,
    frame: false,
    backgroundColor: WINDOW_BACKGROUND[activeScheme()],
    titleBarStyle: mac ? "hiddenInset" : "hidden",
    trafficLightPosition: mac ? TRAFFIC_LIGHT_POSITION : undefined,
    icon: windowIcon(),
    webPreferences: {
      preload: join(import.meta.dirname, PRELOAD_FILE),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      additionalArguments: [runtimeArgument(kind)],
    },
  };
}

export async function loadRoute(window: BrowserWindow, route: string): Promise<void> {
  const devUrl = process.env[ENV.rendererUrl];
  const hash = route.startsWith("/") ? route : `/${route}`;
  if (devUrl) await window.loadURL(`${devUrl}#${hash}`);
  else await window.loadFile(rendererEntryFile(), { hash });
}

function track(kind: WindowKind, window: BrowserWindow): BrowserWindow {
  windows.set(kind, window);
  trackRendererLoad(window.webContents);
  window.on("closed", () => {
    if (windows.get(kind) === window) windows.delete(kind);
  });
  return window;
}

export function getWindow(kind: WindowKind): BrowserWindow | null {
  const window = windows.get(kind);
  return window && !window.isDestroyed() ? window : null;
}

export function allWindows(): BrowserWindow[] {
  return [...windows.values()].filter((window) => !window.isDestroyed());
}

function hideInsteadOfClosing(window: BrowserWindow): void {
  window.on("session-end", markQuitting);
  window.on("close", (event) => {
    if (!shouldHideOnClose()) return;
    event.preventDefault();
    if (window.isFullScreen()) {
      window.once("leave-full-screen", () => window.hide());
      window.setFullScreen(false);
    } else {
      window.hide();
    }
  });
}

export async function createMainWindow(route: string = ROUTE.page(DEFAULT_PAGE), show = true): Promise<BrowserWindow> {
  const existing = getWindow("main");
  if (existing) {
    if (show) focusWindow(existing);
    return existing;
  }
  const restored = restoredMainWindow(MAIN_WINDOW);
  const window = track(
    "main",
    new BrowserWindow({
      ...baseWindowOptions("main"),
      ...MAIN_WINDOW,
      x: restored.x,
      y: restored.y,
      width: restored.width,
      height: restored.height,
      title: WINDOW_LABELS.main,
    }),
  );
  if (restored.maximized) window.maximize();
  persistWindowState(window);
  hideInsteadOfClosing(window);
  window.webContents.setZoomFactor(currentSettings().zoom);
  if (show) window.once("ready-to-show", () => window.show());
  await loadRoute(window, route);
  return window;
}

export async function createOnboardingWindow(step: OnboardingStepId = "welcome"): Promise<BrowserWindow> {
  const existing = getWindow("onboarding");
  if (existing) {
    focusWindow(existing);
    return existing;
  }
  const parent = getWindow("main") ?? undefined;
  const window = track(
    "onboarding",
    new BrowserWindow({
      ...baseWindowOptions("onboarding"),
      ...ONBOARDING_WINDOW,
      title: WINDOW_LABELS.onboarding,
      parent: parent?.isVisible() ? parent : undefined,
      modal: Boolean(parent?.isVisible()),
      center: true,
    }),
  );
  window.webContents.setZoomFactor(currentSettings().zoom);
  window.once("ready-to-show", () => window.show());
  await loadRoute(window, ROUTE.onboarding(step));
  return window;
}

export async function createHostTerminalWindow(url: string, title: string): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    ...HOST_TERMINAL_WINDOW,
    title,
    show: false,
    backgroundColor: WINDOW_BACKGROUND.graphite,
    icon: windowIcon(),
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  window.on("page-title-updated", (event) => event.preventDefault());
  window.once("ready-to-show", () => window.show());
  await window.loadURL(url);
  return window;
}

export function focusWindow(window: BrowserWindow): void {
  if (window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  if (!window.isVisible()) window.show();
  window.focus();
}

export function primaryWindow(): BrowserWindow | null {
  return getWindow("main") ?? getWindow("onboarding") ?? getWindow("snapshot");
}

export function trackSnapshotWindow(window: BrowserWindow): BrowserWindow {
  return track("snapshot", window);
}

export function applyWindowScheme(): void {
  const color = WINDOW_BACKGROUND[activeScheme()];
  for (const window of allWindows()) window.setBackgroundColor(color);
}

export function applyWindowZoom(zoom: number): void {
  for (const window of allWindows()) {
    if (windows.get("snapshot") === window) continue;
    if (Math.abs(window.webContents.getZoomFactor() - zoom) > 1e-6) window.webContents.setZoomFactor(zoom);
  }
}
