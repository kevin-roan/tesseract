import type { Variants } from "motion/react";
import { transition } from "../../theme/motion";

export const PALETTE_SHEET_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.98, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: transition.normal },
  exit: { opacity: 0, scale: 0.98, y: -4, transition: transition.exit },
};

export const PALETTE_HIGHLIGHT_TRANSITION = transition.fast;
