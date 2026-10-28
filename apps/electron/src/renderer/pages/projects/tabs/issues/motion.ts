import type { Variants } from "motion/react";
import { transition } from "../../../../theme/motion";

export const sheetSlide: Variants = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0, transition: transition.normal },
  exit: { opacity: 0, x: 32, transition: transition.exit },
};
