import type { Variants } from "motion/react";
import { transition } from "../../theme/motion";

const BANNER_RISE_PX = 8;
const DRAWER_SLIDE = { ...transition.normal, duration: 0.22 };

export const BANNER_VARIANTS: Variants = {
  initial: { opacity: 0, y: BANNER_RISE_PX },
  animate: { opacity: 1, y: 0, transition: transition.normal },
  exit: { opacity: 0, y: BANNER_RISE_PX, transition: transition.normal },
};

export const DRAWER_VARIANTS: Variants = {
  hidden: { x: "-100%", transition: DRAWER_SLIDE },
  shown: { x: 0, transition: DRAWER_SLIDE },
};

export const SCRIM_VARIANTS: Variants = {
  hidden: { opacity: 0, transition: transition.normal },
  shown: { opacity: 1, transition: transition.normal },
};

export const VIEW_FADE_TRANSITION = transition.fast;
