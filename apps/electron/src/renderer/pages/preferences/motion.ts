import type { Variants } from "motion/react";
import { EASE, transition } from "../../theme/motion";
import { PAGE_SWITCH } from "./constants";

export const sectionSwitch: Variants = {
  shown: { opacity: 1, y: 0, transition: { duration: PAGE_SWITCH.durationMs / 1000, ease: EASE.decelerate } },
  hidden: { opacity: 0, y: PAGE_SWITCH.offsetY, transition: { duration: 0 } },
};

export const navHighlight = transition.fast;
