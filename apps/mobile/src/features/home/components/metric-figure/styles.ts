import { StyleSheet } from "react-native";

import { type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: theme.spacing.xs,
    },
    value: {
      flexShrink: 1,
      fontVariant: ["tabular-nums"],
    },
    unit: {
      flexShrink: 0,
    },
  });
}
