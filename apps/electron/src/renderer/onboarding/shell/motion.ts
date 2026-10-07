import type { Variants } from "motion/react";
import { EASE, STAGGER_MS, stagger, transition } from "../../theme/motion";

export const STEP_SHIFT_PX = 8;

export const STEP_VARIANTS: Variants = {
  initial: (direction: number) => ({ opacity: 0, x: STEP_SHIFT_PX * direction }),
  animate: { opacity: 1, x: 0, transition: transition.normal },
  exit: (direction: number) => ({ opacity: 0, x: -STEP_SHIFT_PX * direction, transition: transition.exit }),
};

export const GLYPH_VARIANTS: Variants = {
  initial: { opacity: 0, scale: 0.6 },
  animate: (done: boolean) => ({
    opacity: 1,
    scale: 1,
    transition: done ? transition.overshoot : transition.normal,
  }),
  exit: { opacity: 0, scale: 0.6, transition: transition.exit },
};

export const RAIL_HIGHLIGHT_TRANSITION = transition.normal;

export const CHEVRON_OPEN_DEG = 90;

export const CHEVRON_TRANSITION = { duration: transition.normal.duration, ease: EASE.standard };

export const CHECK_GLYPH_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transition.fast },
  exit: { opacity: 0, transition: transition.fast },
};

export const CHECK_ROW_RISE_PX = 4;

export const CHECK_ROW_VARIANTS: Variants = {
  initial: { opacity: 0, y: CHECK_ROW_RISE_PX },
  animate: (index: number) => ({ opacity: 1, y: 0, transition: stagger(index, STAGGER_MS.checks) }),
};
