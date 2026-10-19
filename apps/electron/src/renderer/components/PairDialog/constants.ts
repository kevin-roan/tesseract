import type { IconName } from "../../theme/icons";
import { PAIR_LABELS } from "./labels";

export const PAIR_WIDTH = 440;
export const QR_SIZE = 176;
export const QR_ERROR_CORRECTION = "M";

export type PairTarget = "sandbox" | "host" | "master";

export const PAIR_TARGETS: readonly { id: PairTarget; label: string; icon: IconName }[] = [
  { id: "sandbox", label: PAIR_LABELS.tabSandbox, icon: "sandbox" },
  { id: "host", label: PAIR_LABELS.tabHost, icon: "host" },
  { id: "master", label: PAIR_LABELS.tabMaster, icon: "server" },
];

export const PAIR_TEXT = {
  sandbox: { instructions: PAIR_LABELS.instructions, secret: PAIR_LABELS.secret },
  host: { instructions: PAIR_LABELS.hostInstructions, secret: PAIR_LABELS.hostSecret },
  master: { instructions: PAIR_LABELS.hostInstructions, secret: PAIR_LABELS.hostSecret },
} as const satisfies Record<PairTarget, { instructions: string; secret: string }>;
