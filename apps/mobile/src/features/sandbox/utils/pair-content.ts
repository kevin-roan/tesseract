import type { Tone } from "@/lib/tone";

import type { ScannerPermission } from "../hooks/use-qr-scanner";
import type { PairingStatus } from "../types";

export type PairStatusLine = { tone: Tone; message: string };

export const PAIR_SCREEN = {
  title: "Pair a sandbox",
  subtitle: "Connect over your tailnet",
  manualTitle: "Or enter it by hand",
  manualChip: "manual",
  linkFormTitle: "Check the details",
  linkFormChip: "from link",
  linkTitle: "Opened from a pairing link",
  linkChip: "verify",
  linkMessage: "Only pair with a sandbox you run yourself. The token gives full control of it.",
} as const;

export const QR_SCANNER = {
  title: "Scan the pairing code",
  footer: "theone://pair",
  rescan: "Scan again",
  allow: "Allow camera",
  openSettings: "Open Settings",
  promptMessage: "Scan the QR code printed by `theone-controller pair` to connect in one step.",
  blockedMessage: "Camera access is turned off for Monolith. Allow it in Settings to scan the pairing code.",
} as const;

export const PAIRING_FIELDS = {
  url: {
    label: "Controller URL",
    hint: "Your sandbox's Tailscale address, or paste a theone://pair link.",
    placeholder: "https://theone-sandbox.your-tailnet.ts.net",
  },
  token: {
    label: "Token",
    hint: "Printed by `theone-controller pair` inside the sandbox.",
    placeholder: "Pairing token",
  },
  name: {
    label: "Name (optional)",
    placeholder: "Defaults to the sandbox id",
  },
} as const;

type PairingFieldContent = { label: string; hint?: string; placeholder: string };

export type PairingFieldsContent = { url: PairingFieldContent; token: PairingFieldContent; name: PairingFieldContent };

export const PAIRING_SUBMIT_LABEL = "Pair sandbox";

export const STATUS_PROMPT = "›";

const QR_PLACEHOLDER_PATTERN = [
  "111111100",
  "100000101",
  "101110100",
  "101110011",
  "100000110",
  "111111101",
  "001010011",
  "110011010",
  "101101011",
];

export const QR_PLACEHOLDER_LEVELS = QR_PLACEHOLDER_PATTERN.map((row) => [...row].map(Number));

const SCANNER_CHIPS: Record<ScannerPermission, PairStatusLine> = {
  unknown: { tone: "neutral", message: "checking" },
  granted: { tone: "success", message: "camera · live" },
  prompt: { tone: "neutral", message: "camera · off" },
  blocked: { tone: "danger", message: "blocked" },
};

export function scannerChip(permission: ScannerPermission, paused: boolean): PairStatusLine {
  if (permission === "granted" && paused) return { tone: "neutral", message: "paused" };
  return SCANNER_CHIPS[permission];
}

export function pairingStatusLine(
  status: PairingStatus,
  message: string | null,
  validatingMessage = "Checking the sandbox…",
): PairStatusLine | null {
  if (message) return { tone: "danger", message };
  if (status === "validating") return { tone: "neutral", message: validatingMessage };
  if (status === "paired") return { tone: "success", message: "Paired." };
  return null;
}
