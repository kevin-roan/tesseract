import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const ChartFrame = {
  plotHeight: 168,
  axisGutter: 44,
  axisBand: 24,
  topPad: 8,
  tickGap: 6,
  tickFontSize: 11,
  dimmedOpacity: 0.3,
} as const;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    chart: {
      gap: theme.spacing.md,
    },
    frame: {
      height: ChartFrame.plotHeight + ChartFrame.topPad + ChartFrame.axisBand,
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: ChartFrame.axisGutter,
      right: 0,
      height: ChartFrame.plotHeight + ChartFrame.topPad,
    },
  });
}
