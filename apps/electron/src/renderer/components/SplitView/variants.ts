import type { Variants } from "motion/react";
import { transition } from "../../theme/motion";

export const PANE_SLIDE_PX = 24;

export const SIDEBAR_PANE_VARIANTS: Variants = {
  shown: { display: "flex", opacity: 1, x: 0, transition: transition.normal },
  hidden: { opacity: 0, x: -PANE_SLIDE_PX, transition: transition.exit, transitionEnd: { display: "none" } },
};

export const CONTENT_PANE_VARIANTS: Variants = {
  shown: { display: "flex", opacity: 1, x: 0, transition: transition.normal },
  hidden: { opacity: 0, x: PANE_SLIDE_PX, transition: transition.exit, transitionEnd: { display: "none" } },
};
