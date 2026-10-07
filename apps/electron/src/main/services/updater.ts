import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import type { AppUpdater } from "electron-updater";
import { createLogger } from "../../core/log";
import type { UpdateState } from "../../shared/contracts/updates";
import { markQuitting } from "../app/lifecycle";
import { LINUX_PACKAGE_TYPE_FILE, UPDATE_CHECK_INTERVAL_MS, UPDATE_FIRST_CHECK_DELAY_MS, UPDATES_DISABLED_ENV } from "../constants";
import { mainContext, platform } from "../context";
import { broadcast } from "../ipc/_framework/events";
import { UPDATE_LABELS } from "../labels";
import { showNotification } from "./notifications";
import { setTrayUpdate } from "./tray";
import { reduceUpdate, releaseNotes, unsupportedReason, type UpdaterEvent } from "./update-state";

const log = createLogger("updates");

let state: UpdateState = { kind: "idle", checkedAt: null };
let instance: Promise<AppUpdater> | null = null;
let background = false;

function reason(): string | null {
  return unsupportedReason({
    packaged: app.isPackaged,
    isTest: mainContext().isTest,
    disabled: process.env[UPDATES_DISABLED_ENV] === "1",
    platform: platform(),
    appImage: Boolean(process.env.APPIMAGE),
    linuxPackage: app.isPackaged && existsSync(join(process.resourcesPath, LINUX_PACKAGE_TYPE_FILE)),
  });
}

function set(next: UpdateState): UpdateState {
  const before = state;
  state = next;
  if (before !== next) broadcast("updates", "state", state);
  if (next.kind === "ready" && before.kind !== "ready") onReady(next.version);
  return state;
}

function dispatch(event: UpdaterEvent): UpdateState {
  return set(reduceUpdate(state, event));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function onReady(version: string): void {
  setTrayUpdate(version, () => void installUpdate());
  showNotification({ id: "update-ready", title: UPDATE_LABELS.readyTitle, body: UPDATE_LABELS.readyBody(version) });
}

async function load(): Promise<AppUpdater> {
  const module = await import("electron-updater");
  const updater = (module as unknown as { default?: { autoUpdater?: AppUpdater } }).default?.autoUpdater ?? module.autoUpdater;
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.logger = { info: (text) => log.debug(String(text)), warn: (text) => log.warn(String(text)), error: (text) => log.error(String(text)), debug: (text) => log.debug(String(text)) };
  updater.on("checking-for-update", () => dispatch({ type: "checking" }));
  updater.on("update-available", (info) => {
    dispatch({ type: "available", version: info.version, notes: releaseNotes(info.releaseNotes) });
    if (background) void downloadUpdate();
  });
  updater.on("update-not-available", () => dispatch({ type: "not-available", at: new Date().toISOString() }));
  updater.on("download-progress", (progress) =>
    dispatch({ type: "progress", received: progress.transferred, total: progress.total || null, bytesPerSecond: progress.bytesPerSecond || null }),
  );
  updater.on("update-downloaded", (info) => dispatch({ type: "downloaded", version: info.version }));
  updater.on("error", (error) => dispatch({ type: "error", message: message(error) }));
  return updater;
}

function updater(): Promise<AppUpdater> {
  instance ??= load().catch((error: unknown) => {
    instance = null;
    throw error;
  });
  return instance;
}

export function updateState(): UpdateState {
  const unsupported = reason();
  return unsupported ? { kind: "unsupported", reason: unsupported } : state;
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (reason()) return updateState();
  if (state.kind === "checking" || state.kind === "downloading" || state.kind === "ready") return state;
  try {
    const result = await (await updater()).checkForUpdates();
    if (!result) return dispatch({ type: "not-available", at: new Date().toISOString() });
  } catch (error) {
    return dispatch({ type: "error", message: message(error) });
  }
  return state;
}

export async function downloadUpdate(): Promise<UpdateState> {
  if (reason() || state.kind !== "available") return updateState();
  dispatch({ type: "progress", received: 0, total: null, bytesPerSecond: null });
  try {
    await (await updater()).downloadUpdate();
  } catch (error) {
    return dispatch({ type: "error", message: message(error) });
  }
  return state;
}

export async function installUpdate(): Promise<void> {
  if (state.kind !== "ready") throw new Error(UPDATE_LABELS.notReady);
  const current = await updater();
  markQuitting();
  setImmediate(() => current.quitAndInstall(false, true));
}

export function startBackgroundUpdates(): () => void {
  if (reason()) return () => undefined;
  const run = () => {
    background = true;
    void checkForUpdates().finally(() => {
      background = false;
    });
  };
  const first = setTimeout(run, UPDATE_FIRST_CHECK_DELAY_MS);
  const every = setInterval(run, UPDATE_CHECK_INTERVAL_MS);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
