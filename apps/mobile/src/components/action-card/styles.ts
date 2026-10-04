import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    /** Fills its cell so tiles sharing a row end up the same size. */
    card: {
      flex: 1,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
    },
    label: {
      textAlign: "center",
    },
    pressable: {
      flex: 1,
    },
  });
}
