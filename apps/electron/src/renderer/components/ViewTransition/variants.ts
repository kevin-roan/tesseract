import type { Variants } from "motion/react";
import { transition } from "../../theme/motion";
import type { ViewDirection } from "./direction";

export const VIEW_SLIDE_PX = 24;

export const VIEW_VARIANTS: Variants = {
  enter: (direction: ViewDirection) => ({
    opacity: 0,
    x: direction === "forward" ? VIEW_SLIDE_PX : direction === "back" ? -VIEW_SLIDE_PX : 0,
  }),
  center: (direction: ViewDirection) => ({
    opacity: 1,
    x: 0,
    transition: direction === "none" ? transition.fast : transition.normal,
  }),
  exit: (direction: ViewDirection) => ({
    opacity: 0,
    x: direction === "back" ? VIEW_SLIDE_PX / 2 : direction === "forward" ? -VIEW_SLIDE_PX / 2 : 0,
    transition: transition.exit,
  }),
};
