import type { Transition, Variants } from "motion/react";
import { transition } from "../../theme/motion";

const INSTANT: Transition = { duration: 0 };

export function paneTransition(animate: boolean): Transition {
  return animate ? transition.normal : INSTANT;
}

export const DRAWER_VARIANTS: Variants = {
  shown: { x: 0, transition: transition.normal },
  hidden: { x: "-100%", transition: transition.normal },
};

export const SCRIM_VARIANTS: Variants = {
  shown: { opacity: 1, transition: transition.normal },
  hidden: { opacity: 0, transition: transition.normal },
};
