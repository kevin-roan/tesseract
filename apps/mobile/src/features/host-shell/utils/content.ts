import { HOST_PAIRING_ACTION, PAIRING_SCHEME } from "@theone/protocol";
import { LockSimpleIcon, PlusIcon, TrashIcon } from "phosphor-react-native";

import type { HeaderAction } from "@/components/screen-header";
import type { PairingFieldsContent } from "@/features/sandbox/utils/pair-content";

type ActionTemplate = Omit<HeaderAction, "onPress">;

export const HOST_SCREEN = {
  title: "Host shell",
  setupSubtitle: "Pair with the host over your tailnet",
  lockedSubtitle: "Enter the PIN set on the host",
  linkTitle: "Opened from a host link",
  linkChip: "verify",
  linkMessage: "Only pair with a host you own. With the PIN, this gives a full shell on that machine.",
  manualTitle: "Or enter it by hand",
  manualChip: "manual",
  linkFormTitle: "Check the details",
  linkFormChip: "from link",
  pinTitle: "Unlock",
  sessionsTitle: "Shells",
  newShell: "New shell",
  emptyTitle: "No shells open",
  emptyMessage: "Start a login shell on the host. It keeps running when you leave the screen.",
  loadingTitle: "Loading shells…",
  sessionChip: (countdown: string) => `unlocked · ${countdown}`,
  pinMissing: "No PIN is set on the host. Run `bun run host pin` there, then try again.",
  repairTitle: "Pair the host again",
  repair: "Pair again",
  retry: "Retry",
} as const;

export const HOST_QR = {
  title: "Scan the host code",
  footer: `${PAIRING_SCHEME}://${HOST_PAIRING_ACTION}`,
  promptMessage: "Scan the QR code printed by `bun run host pair` on the host.",
} as const;

export const HOST_PAIRING_FIELDS: PairingFieldsContent = {
  url: {
    label: "Host URL",
    hint: "The host's Tailscale address and port, or paste a theone://host link.",
    placeholder: "http://100.64.0.1:7701",
  },
  token: {
    label: "Host token",
    hint: "Printed by `bun run host pair` on the host.",
    placeholder: "Host token",
  },
  name: {
    label: "Name (optional)",
    placeholder: "Defaults to the host name",
  },
};

export const HOST_PAIRING_SUBMIT = "Pair host";
export const HOST_PAIRING_VALIDATING = "Checking the host…";

export const HOST_ACTIONS = {
  lock: { id: "lock", icon: LockSimpleIcon, label: "Lock the host shell" },
  newShell: { id: "new-shell", icon: PlusIcon, label: "New shell" },
  unpair: { id: "unpair", icon: TrashIcon, label: "Forget this host", tone: "danger" },
} satisfies Record<string, ActionTemplate>;

export const UNPAIR_CONFIRM = {
  title: "Forget this host?",
  message: "The host token is removed from this phone. Shells on the host keep running.",
  confirmLabel: "Forget host",
  destructive: true,
} as const;

export const CLOSE_CONFIRM = {
  title: "Close this shell?",
  message: "Programs running in it are stopped. Leaving the screen instead keeps the shell alive.",
  confirmLabel: "Close shell",
  destructive: true,
} as const;

export const PROFILE_ENTRY = {
  title: "Host shell",
  unpaired: "Not paired · PIN protected",
  paired: (name: string) => `${name} · PIN protected`,
} as const;
