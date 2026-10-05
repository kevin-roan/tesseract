import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    tab: {
      minHeight: ControlHeight.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
    },
    selected: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    badge: {
      fontVariant: ["tabular-nums"],
    },
  });
}
