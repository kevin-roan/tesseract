import type { Variants } from "motion/react";
import { transition } from "../../theme/motion";

export const PAGE_SWITCH_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transition.fast },
};
