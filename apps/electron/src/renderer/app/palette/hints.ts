import { PALETTE_LABELS } from "./labels";

export const PALETTE_FOOTER_HINTS: readonly { keys: readonly string[]; label: string }[] = [
  { keys: ["Up", "Down"], label: PALETTE_LABELS.navigate },
  { keys: ["Enter"], label: PALETTE_LABELS.select },
  { keys: ["Esc"], label: PALETTE_LABELS.close },
];
