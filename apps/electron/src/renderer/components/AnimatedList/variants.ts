import type { Variants } from "motion/react";
import { STAGGER_MS, stagger, transition } from "../../theme/motion";

export const LIST_ITEM_RISE_PX = 4;

export const LIST_ITEM_VARIANTS: Variants = {
  initial: { opacity: 0, y: LIST_ITEM_RISE_PX },
  animate: (index: number | undefined) => ({
    opacity: 1,
    y: 0,
    transition: index === undefined ? transition.fast : stagger(index, STAGGER_MS.rows),
  }),
  exit: {
    opacity: 0,
    height: 0,
    transition: transition.exit,
  },
};

export const LIST_LAYOUT_TRANSITION = transition.normal;
