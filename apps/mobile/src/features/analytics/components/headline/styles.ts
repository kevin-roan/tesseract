import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    headline: {
      gap: theme.spacing.xxs,
    },
    figure: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: theme.spacing.sm,
    },
    delta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
  });
}
