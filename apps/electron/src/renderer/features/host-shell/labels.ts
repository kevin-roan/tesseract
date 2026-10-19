import type { HostAccess, HostGateAction } from "./types";

export interface HostGateLabel {
  title: string;
  message: string | null;
}

export const HOST_GATE_LABELS: Record<Exclude<HostAccess, "ready">, HostGateLabel> = {
  loading: { title: "Checking the host shell…", message: null },
  stopped: { title: "The host shell is off", message: "Start the host shell to use this computer's terminals and emulator from Tesseract." },
  starting: { title: "Starting the host shell…", message: null },
  failed: { title: "The host shell failed", message: null },
  noHost: { title: "No host shell for this machine", message: "This machine has no host shell paired with Tesseract. Set one up in the host shell settings." },
  noPin: { title: "Set a host shell PIN", message: "The host shell needs a PIN before the app can open terminals or drive the emulator." },
  locked: { title: "The host shell is locked", message: "Enter the host shell PIN to continue." },
};

export const HOST_GATE_ACTION_LABELS: Record<HostGateAction, string> = {
  start: "Start host shell",
  unlock: "Unlock",
  preferences: "Host shell settings",
};

export const HOST_ERROR_LABELS = {
  start: (error: string) => `Couldn't start the host shell: ${error}`,
  lock: (error: string) => `Couldn't lock the host shell: ${error}`,
} as const;
