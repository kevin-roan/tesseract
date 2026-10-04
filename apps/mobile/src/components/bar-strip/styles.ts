import { StyleSheet } from "react-native";

import { Spacing, type Theme } from "@/theme";

export const BAR_WIDTH = Spacing.xxs;
export const BAR_GAP = Spacing.xxs;

export default function createStyles(theme: Theme, height?: number) {
  return StyleSheet.create({
    strip: {
      height: height ?? theme.spacing["5xl"] + theme.spacing.base,
      overflow: "hidden",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.chart.grid,
    },
    track: {
      ...StyleSheet.absoluteFill,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: BAR_GAP,
      transformOrigin: "bottom",
    },
    bar: {
      width: BAR_WIDTH,
    },
    strong: {
      backgroundColor: theme.chart.bar,
    },
    quiet: {
      backgroundColor: theme.chart.sequential[2],
    },
  });
}
