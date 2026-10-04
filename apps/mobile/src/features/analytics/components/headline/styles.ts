import { StyleSheet } from "react-native";

import { FontWeights, displayFor, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    headline: {
      gap: theme.spacing.sm,
    },
    figure: {
      flexDirection: "row",
      alignItems: "baseline",
      flexWrap: "wrap",
      columnGap: theme.spacing.sm,
    },
    value: {
      fontFamily: displayFor(FontWeights.regular),
    },
    delta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xxs,
    },
    tabular: {
      fontVariant: ["tabular-nums"],
    },
  });
}
