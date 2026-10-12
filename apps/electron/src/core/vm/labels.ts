import { VM_PROFILE } from "./constants";

export const VM_MESSAGES = {
  unsupported: "The Tesseract VM is only needed on macOS",
  noBrew: "Homebrew isn't installed. Install it with the command below in Terminal, then try again.",
  noColima: "Colima isn't installed. Set up the Tesseract VM first.",
  brewFailed: (detail: string) => `Installing the VM tools with Homebrew failed: ${detail}`,
  startFailed: (detail: string) => `The Tesseract VM didn't start: ${detail}`,
  stopFailed: (detail: string) => `The Tesseract VM didn't stop: ${detail}`,
  contextFailed: (detail: string) => `Couldn't switch Docker to the Tesseract VM: ${detail}`,
  sysboxTimeout: (seconds: number) =>
    `The Tesseract VM is running, but Sysbox wasn't ready within ${seconds} seconds. Check the Sysbox services and the provisioning log with the commands below.`,
  provisionFailed: (detail: string) =>
    `Installing Sysbox in the Tesseract VM failed: ${detail}. Check the Sysbox services and the provisioning log with the commands below.`,
  cancelled: "Setting up the Tesseract VM was cancelled",
} as const;

export const VM_LOG_MESSAGES = {
  brewMissing: "Homebrew isn't installed",
  installingTools: (formulas: readonly string[]) => `Installing ${formulas.join(", ")} with Homebrew`,
  toolsPresent: "Colima and the Docker tools are installed",
  pluginsDir: (dir: string, file: string) => `Added ${dir} to cliPluginsExtraDirs in ${file}`,
  dockerConfigInvalid: (file: string) => `${file} isn't valid JSON; leaving it unchanged (add cliPluginsExtraDirs yourself)`,
  configWritten: (file: string) => `Wrote ${file}`,
  configCurrent: (file: string) => `${file} is up to date`,
  configUserOwned: (file: string) =>
    `${file} was edited by hand (no tesseract-managed marker), so Tesseract leaves it alone. Make sure it keeps the sysbox-runc runtime and provision script.`,
  dockerDesktopRunning:
    "Docker Desktop is running. Quit it before using the Tesseract VM: two VMs don't fit in this Mac's memory.",
  restarting: `The ${VM_PROFILE} VM is running without Sysbox; restarting it`,
  broken: `The ${VM_PROFILE} VM is in a broken state; force-stopping it before starting`,
  reprovisioning: "Sysbox isn't running in the VM; running the Sysbox provision script again",
  waitingSysbox: (seconds: number) => `Waiting for the sysbox-runc runtime and the Sysbox services (${seconds}s)`,
  sysboxReady: "The sysbox-runc runtime and the Sysbox services are ready",
} as const;
