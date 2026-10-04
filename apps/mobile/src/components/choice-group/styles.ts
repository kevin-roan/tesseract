import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    // ScrollView defaults to flexGrow: 1, which stretches the row down a growing parent.
    scroller: {
      flexGrow: 0,
    },
    wrap: {
      flexWrap: "wrap",
    },
  });
}
