import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    mix: {
      gap: theme.spacing.md,
    },
    bar: {
      flexDirection: "row",
      height: theme.spacing.base,
      gap: theme.spacing.xxs,
      transformOrigin: "left",
    },
    segment: {
      borderRadius: theme.radius.xs,
      borderCurve: "continuous",
    },
    empty: {
      flex: 1,
      backgroundColor: theme.colors.backgroundSelected,
    },
  });
}
