import type { HostShellStatus } from "../../../../shared/contracts/hostShell";
import type { HostTailnetMode, HostTailnetStatus } from "../../../../shared/contracts/tailnet";

export const HOST_SHELL_LABELS = {
  title: "Host shell",
  refresh: "Refresh",
  server: {
    title: "Server",
    description:
      "Lets paired phones open a terminal on this computer over Tailscale or the Tesseract Network. Tesseract runs it in the background and stops it when you quit.",
  },
  serve: {
    title: "Serve host shell",
    status: {
      stopped: "Stopped",
      starting: "Starting…",
      running: "Running",
      stopping: "Stopping…",
      external: "Running outside Tesseract",
      failed: "Failed",
    } satisfies Record<HostShellStatus, string>,
    failed: (error: string) => `Failed: ${error}`,
  },
  autostart: {
    title: "Start with Tesseract",
    subtitle: "Start serving whenever Tesseract opens",
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
    pairSubtitle: "Show the tesseract://host link and QR code",
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
  tailnet: {
    title: "Tesseract Network",
    description:
      "Puts the host shell and the host workspace on your Tesseract account's network, so phones reach them without Tailscale. They then listen on 127.0.0.1 only.",
    modes: {
      auto: { title: "Automatic", subtitle: "When you're signed in and Tailscale isn't running on this computer" },
      on: { title: "On", subtitle: "Whenever you're signed in, also next to Tailscale" },
      off: { title: "Off", subtitle: "Only Tailscale" },
    } satisfies Record<HostTailnetMode, { title: string; subtitle: string }>,
    status: {
      off: "Off",
      "signed-out": "Sign in under Settings › Account to use it",
      missing: "Not bundled with this build",
      starting: "Connecting…",
      running: "Connected",
      needs_login: "Needs a new key; sign in again",
      error: "Failed",
    } satisfies Record<HostTailnetStatus, string>,
    statusTitle: "Status",
    tailscaleDetected: "Tailscale is running on this computer",
    restart: "Reconnect",
    openAccount: "Account…",
    modeFailed: (error: string) => `Couldn't change the setting: ${error}`,
    restartFailed: (error: string) => `Couldn't reconnect: ${error}`,
  },
} as const;
