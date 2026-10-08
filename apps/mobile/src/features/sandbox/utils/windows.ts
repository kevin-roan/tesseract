import type { DisplayWindow } from "@tesseract/protocol";

export const WINDOWS_COPY = {
  title: "Open windows",
  subtitle: "Apps on the sandbox display. Tap one to bring it to the front.",
  emptyTitle: "No windows open",
  emptyMessage: "Nothing is showing on the sandbox display. Start an app, or right-click the desktop for a terminal or Chromium.",
  errorTitle: "Couldn't list the windows",
  loading: "Reading the sandbox's windows…",
  forceTitle: "Force quit this app?",
  forceMessage: "Its process is killed without a chance to save. Use this when the window doesn't respond to Close.",
} as const;

export function windowTitle(window: DisplayWindow): string {
  return window.title.trim() || window.app || "Untitled window";
}

/** Second line of a row: the app and whether it is focused or minimized. */
export function windowDetail(window: DisplayWindow): string {
  const state = window.active ? "Active" : window.minimized ? "Minimized" : null;
  return [window.app, state].filter(Boolean).join(" · ");
}
