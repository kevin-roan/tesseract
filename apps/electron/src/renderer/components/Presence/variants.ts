import type { Variants } from "motion/react";
import { fade, transition } from "../../theme/motion";

export type CrossfadeSpeed = "fast" | "normal";

export const CROSSFADE_VARIANTS: Record<CrossfadeSpeed, Variants> = {
  fast: { ...fade, animate: { opacity: 1, transition: transition.fast } },
  normal: fade,
};
