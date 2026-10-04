import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const HeatmapFrame = {
  labelGutter: 36,
  cellHeight: 16,
  hours: 24,
  gap: 2,
  axisBand: 20,
  fontSize: 11,
  hourStep: 6,
  axisBaseline: 4,
  cellRadius: 4,
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
    row: {
      position: "absolute",
      left: HeatmapFrame.labelGutter,
      right: 0,
      height: HeatmapFrame.cellHeight,
    },
    selection: {
      position: "absolute",
      top: 0,
      left: 0,
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
      gap: theme.spacing.xxs,
    },
    swatch: {
      width: theme.spacing.md,
      height: theme.spacing.md,
      borderRadius: theme.radius.xs,
    },
  });
}
