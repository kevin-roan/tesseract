import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    label: {
      flexShrink: 0,
    },
    value: {
      flexShrink: 1,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
  });
}
