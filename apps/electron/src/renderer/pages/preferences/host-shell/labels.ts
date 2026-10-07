import type { HostShellStatus } from "../../../../shared/contracts/hostShell";

export const HOST_SHELL_LABELS = {
  title: "Host shell",
  refresh: "Refresh",
  server: {
    title: "Server",
    description:
      "Lets paired phones open a terminal on this computer over Tailscale. Monolith runs it in the background and stops it when you quit.",
  },
  serve: {
    title: "Serve host shell",
    status: {
      stopped: "Stopped",
      starting: "Starting…",
      running: "Running",
      stopping: "Stopping…",
      external: "Running outside Monolith",
      failed: "Failed",
    } satisfies Record<HostShellStatus, string>,
    failed: (error: string) => `Failed: ${error}`,
  },
  autostart: {
    title: "Start with Monolith",
    subtitle: "Start serving whenever Monolith opens",
  },
  security: { title: "Security" },
  pin: {
    title: "PIN",
    set: "Set · phones unlock with it",
    unset: "Not set · phones can't unlock the shell",
    change: "Change…",
    setPin: "Set PIN…",
  },
  token: {
    title: "Host token",
    subtitle: "Paired phones use it to reach this computer",
    rotate: "Rotate…",
  },
  rotate: {
    heading: "Rotate the host token?",
    body: "Every paired phone stops working until you pair it again.",
    confirm: "Rotate",
    cancel: "Cancel",
    done: "Host token rotated; pair your phones again",
    failed: (error: string) => `Couldn't rotate the token: ${error}`,
  },
  pairing: {
    title: "Pairing",
    pair: "Pair a phone",
    pairSubtitle: "Show the theone://host link and QR code",
    showQr: "Show QR…",
  },
  log: {
    title: "Log",
    empty: "No output yet",
  },
  errors: {
    start: (error: string) => `Couldn't start the host shell: ${error}`,
    stop: (error: string) => `Couldn't stop the host shell: ${error}`,
    autostart: (error: string) => `Couldn't save the setting: ${error}`,
    refresh: (error: string) => `Couldn't check the host shell: ${error}`,
  },
  separator: " · ",
} as const;
