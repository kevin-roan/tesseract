import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const SWATCH_SIZE = 10;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    readout: {
      gap: theme.spacing.sm,
    },
    head: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    items: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: theme.spacing.base,
      rowGap: theme.spacing.xs,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    swatch: {
      width: SWATCH_SIZE,
      height: SWATCH_SIZE,
      borderRadius: 2,
    },
    value: {
      fontVariant: ["tabular-nums"],
    },
  });
}
