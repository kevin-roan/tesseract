import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.base,
    },
    bar: {
      height: theme.spacing.md,
    },
    clip: {
      height: "100%",
      overflow: "hidden",
    },
    cells: {
      flexDirection: "row",
      height: "100%",
      gap: theme.spacing.xxs,
    },
    cell: {
      flex: 1,
      borderRadius: theme.radius.xs,
      borderCurve: "continuous",
    },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: theme.spacing.sm,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      width: "50%",
      paddingRight: theme.spacing.md,
    },
    swatch: {
      width: theme.spacing.sm,
      height: theme.spacing.sm,
      borderRadius: theme.radius.xs,
      borderCurve: "continuous",
    },
    label: {
      flex: 1,
    },
    value: {
      fontVariant: ["tabular-nums"],
    },
  });
}
