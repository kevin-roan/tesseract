import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const DailyBarsFrame = {
  height: 96,
  axisBand: 20,
  fontSize: 11,
  floor: 10,
  hatch: 5,
  dash: "4 3",
} as const;

/** Airy gaps for a week of pills, tight ones for a month. */
export function barGap(count: number): number {
  return count <= 14 ? 10 : 3;
}

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    chart: {
      gap: theme.spacing.md,
    },
    readout: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    readoutTitle: {
      flex: 1,
    },
    readoutPill: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.full,
    },
    frame: {
      height: DailyBarsFrame.height + DailyBarsFrame.axisBand,
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: DailyBarsFrame.height,
    },
  });
}
