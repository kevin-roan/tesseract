import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    readout: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    figure: {
      flexDirection: "row",
      alignItems: "baseline",
      flexWrap: "wrap",
      columnGap: theme.spacing.xs,
    },
    value: {
      flexShrink: 1,
    },
  });
}
