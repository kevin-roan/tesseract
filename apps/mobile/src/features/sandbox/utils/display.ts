import { INPUT_MODES, type DisplayStatus, type InputMode } from "@theone/protocol";

import type { DisplayOutage, PageInsets } from "../types";

export function displayOutage(status: DisplayStatus | undefined): DisplayOutage | null {
  if (!status) return null;
  if (!status.available) {
    return {
      reason: "display",
      title: "The display is not running",
      message: `The sandbox reports no X server on ${status.display}, so there is nothing to show. Run \`theone-doctor\` inside the sandbox, then check again.`,
    };
  }
  if (!status.vnc.available) {
    return {
      reason: "vnc",
      title: "VNC is not running",
      message: `The display ${status.display} is up, but nothing answers on VNC port ${status.vnc.port}. Run \`theone-doctor\` inside the sandbox, then check again.`,
    };
  }
  return null;
}

export function displaySubtitle(status: DisplayStatus | undefined): string | undefined {
  if (!status) return undefined;
  return status.width && status.height ? `${status.display} · ${status.width}×${status.height}` : status.display;
}

export type DisplayInsetsInput = {
  /** Bottom edge of the floating bar, in points from the top of the screen. */
  barBottom: number;
  safeBottom: number;
  fullscreen: boolean;
};

/**
 * Space the page keeps clear of native chrome, in CSS px (1pt = 1px in the WebView). In full screen the
 * stage already sits inside the safe area, so the page needs none.
 */
export function displayInsets({ barBottom, safeBottom, fullscreen }: DisplayInsetsInput): PageInsets {
  if (fullscreen) return { top: 0, bottom: 0 };
  return { top: Math.ceil(Math.max(0, barBottom)), bottom: Math.ceil(Math.max(0, safeBottom)) };
}

export function nextInputMode(mode: InputMode): InputMode {
  return INPUT_MODES[(INPUT_MODES.indexOf(mode) + 1) % INPUT_MODES.length];
}
