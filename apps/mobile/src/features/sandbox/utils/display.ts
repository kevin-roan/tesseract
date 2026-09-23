import type { DisplayStatus } from "@theone/protocol";

import type { DisplayOutage } from "../types";

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
