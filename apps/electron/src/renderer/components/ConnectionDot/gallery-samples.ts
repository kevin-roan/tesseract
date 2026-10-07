import type { Tone } from "../../theme/colors";

export const CONNECTION_DOT_SAMPLES: readonly { tone: Tone; label: string; live?: boolean }[] = [
  { tone: "success", label: "Connected", live: true },
  { tone: "warning", label: "Reconnecting…" },
  { tone: "danger", label: "Offline" },
  { tone: "neutral", label: "Not configured" },
];
