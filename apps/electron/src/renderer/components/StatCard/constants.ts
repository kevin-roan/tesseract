import type { Variants } from "motion/react";
import type { SemanticColor } from "../../theme/colors";
import { transition } from "../../theme/motion";
import type { SurfaceTone } from "../Surface";

export const STAT_GRID = {
  gap: 8,
  minColumns: 2,
  maxColumns: 4,
  minTile: 160,
} as const;

export const STAT_BAR_COLOR: Record<SurfaceTone, SemanticColor> = {
  neutral: "accent",
  violet: "warning",
  indigo: "accent",
  yellow: "accent",
};

export const STAT_ICON_SIZE = 16;

export const VALUE_SWAP_RISE_PX = 2;

export const VALUE_SWAP_VARIANTS: Variants = {
  initial: { opacity: 0.4, y: VALUE_SWAP_RISE_PX },
  animate: { opacity: 1, y: 0, transition: transition.fast },
  exit: { opacity: 0, transition: transition.exit },
};
