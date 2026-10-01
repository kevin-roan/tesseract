import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const HeatmapFrame = {
  labelGutter: 36,
  cellHeight: 16,
  gap: 2,
  radius: 2,
  axisBand: 20,
  fontSize: 11,
  hourStep: 6,
} as const;

export const GRID_HEIGHT = 7 * HeatmapFrame.cellHeight + 6 * HeatmapFrame.gap;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    heatmap: {
      gap: theme.spacing.md,
    },
    frame: {
      height: GRID_HEIGHT + HeatmapFrame.axisBand,
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: HeatmapFrame.labelGutter,
      right: 0,
      height: GRID_HEIGHT,
    },
    scale: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.spacing.xs,
    },
    swatch: {
      width: 12,
      height: 12,
      borderRadius: HeatmapFrame.radius,
    },
  });
}
