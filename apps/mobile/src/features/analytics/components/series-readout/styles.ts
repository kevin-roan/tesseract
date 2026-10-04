import { StyleSheet } from "react-native";

import { type Theme } from "@/theme";

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
    title: {
      flexShrink: 1,
    },
    items: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: theme.spacing.md,
      rowGap: theme.spacing.xs,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    swatch: {
      width: theme.spacing.sm,
      height: theme.spacing.sm,
      borderRadius: theme.radius.xs,
    },
    value: {
      fontVariant: ["tabular-nums"],
    },
  });
}
