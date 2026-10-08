import type { DisplayWindow } from "@tesseract/protocol";

/** One `wmctrl -lp` row: id, desktop, pid, client machine, then the title (which may contain spaces or be empty). */
const WMCTRL_ROW = /^(0x[0-9a-f]+)\s+(-?\d+)\s+(\d+)\s+\S+ ?(.*)$/i;
const ACTIVE_WINDOW = /window id # (0x[0-9a-f]+)/i;
const PROPERTY = /^([A-Z_]+)\([A-Z0-9_]+\)\s*=\s*(.*)$/;

/** Window types tint2 and other taskbars leave out as well. */
const HIDDEN_TYPES = new Set([
  "_NET_WM_WINDOW_TYPE_DESKTOP",
  "_NET_WM_WINDOW_TYPE_DOCK",
  "_NET_WM_WINDOW_TYPE_TOOLBAR",
  "_NET_WM_WINDOW_TYPE_MENU",
  "_NET_WM_WINDOW_TYPE_SPLASH",
  "_NET_WM_WINDOW_TYPE_DROPDOWN_MENU",
  "_NET_WM_WINDOW_TYPE_POPUP_MENU",
  "_NET_WM_WINDOW_TYPE_TOOLTIP",
  "_NET_WM_WINDOW_TYPE_NOTIFICATION",
]);

export type WmctrlWindow = { id: string; pid: number | null; title: string };

export type WindowProps = { app: string | null; types: string[]; states: string[] };

/** Same window whether written `0x3a00004` (xprop) or `0x03a00004` (wmctrl). */
export const sameWindowId = (a: string, b: string): boolean => Number.parseInt(a, 16) === Number.parseInt(b, 16);

export function parseWmctrlList(stdout: string): WmctrlWindow[] {
  const windows: WmctrlWindow[] = [];
  for (const line of stdout.split("\n")) {
    const match = WMCTRL_ROW.exec(line);
    if (!match) continue;
    const [, id = "", , pidText, title = ""] = match;
    const pid = Number(pidText);
    windows.push({ id: id.toLowerCase(), pid: pid > 0 ? pid : null, title: title.trim() });
  }
  return windows;
}

/** `xprop -root _NET_ACTIVE_WINDOW`; `0x0` (nothing focused) is null. */
export function parseActiveWindow(stdout: string): string | null {
  const id = ACTIVE_WINDOW.exec(stdout)?.[1];
  if (!id || Number.parseInt(id, 16) === 0) return null;
  return id.toLowerCase();
}

const atoms = (value: string): string[] =>
  value
    .split(",")
    .map((atom) => atom.trim())
    .filter(Boolean);

/** `xprop -id <id> WM_CLASS _NET_WM_WINDOW_TYPE _NET_WM_STATE`; missing properties print "not found" and stay empty. */
export function parseWindowProps(stdout: string): WindowProps {
  const props: WindowProps = { app: null, types: [], states: [] };
  for (const line of stdout.split("\n")) {
    const match = PROPERTY.exec(line.trim());
    if (!match) continue;
    const [, name, value = ""] = match;
    if (name === "WM_CLASS") props.app = [...value.matchAll(/"((?:[^"\\]|\\.)*)"/g)].at(-1)?.[1] || null;
    else if (name === "_NET_WM_WINDOW_TYPE") props.types = atoms(value);
    else if (name === "_NET_WM_STATE") props.states = atoms(value);
  }
  return props;
}

/** Whether a window belongs in a task list: not a dock/desktop/menu, and not asking to stay off taskbars. */
export function isTaskWindow(props: WindowProps): boolean {
  if (props.types.some((type) => HIDDEN_TYPES.has(type))) return false;
  return !props.states.includes("_NET_WM_STATE_SKIP_TASKBAR");
}

export function toDisplayWindow(window: WmctrlWindow, props: WindowProps, active: string | null): DisplayWindow {
  return {
    id: window.id,
    title: window.title,
    app: props.app,
    pid: window.pid,
    active: active !== null && sameWindowId(window.id, active),
    minimized: props.states.includes("_NET_WM_STATE_HIDDEN"),
  };
}
