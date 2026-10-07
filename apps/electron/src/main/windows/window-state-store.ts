import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app, screen, type BrowserWindow } from "electron";
import { createLogger } from "../../core/log";
import { WINDOW_STATE_FILE, WINDOW_STATE_SAVE_DELAY_MS } from "../constants";
import { parseWindowState, restoreWindow, type RestoredWindow, type SavedWindowState, type WindowSizing } from "./window-state";

const log = createLogger("window-state");

function stateFile(): string {
  return join(app.getPath("userData"), WINDOW_STATE_FILE);
}

export function readWindowState(file = stateFile()): SavedWindowState | null {
  try {
    return parseWindowState(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

export function writeWindowState(state: SavedWindowState, file = stateFile()): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
    renameSync(temp, file);
  } catch (error) {
    log.warn(`could not save the window state: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function restoredMainWindow(sizing: WindowSizing): RestoredWindow {
  const workAreas = screen.getAllDisplays().map((display) => display.workArea);
  return restoreWindow(readWindowState(), workAreas, sizing);
}

function snapshot(window: BrowserWindow): SavedWindowState {
  return { bounds: window.getNormalBounds(), maximized: window.isMaximized() };
}

export function persistWindowState(window: BrowserWindow): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!window.isDestroyed() && !window.isFullScreen() && !window.isMinimized()) writeWindowState(snapshot(window));
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, WINDOW_STATE_SAVE_DELAY_MS);
  };
  window.on("resize", schedule);
  window.on("move", schedule);
  window.on("maximize", save);
  window.on("unmaximize", save);
  window.on("close", save);
  window.on("closed", () => {
    if (timer) clearTimeout(timer);
  });
}
