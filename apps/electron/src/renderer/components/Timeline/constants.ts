import type { Variants } from "motion/react";
import { DURATION_MS, EASE } from "../../theme/motion";

export const MESSAGE_INSET = 13;
export const BODY_INDENT = 28;
export const TIMELINE_WIDTH = 760;
export const TIMELINE_FOLLOW_THRESHOLD_PX = 48;
export const TIMELINE_JUMP_BOTTOM_PX = 16;
export const ACTIVITY_SPINNER_SIZE = 12;
export const MAX_INITIALS = 2;

export const TIMELINE_ITEM_MOTION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION_MS.normal / 1000, ease: EASE.decelerate } },
} as const satisfies Variants;
