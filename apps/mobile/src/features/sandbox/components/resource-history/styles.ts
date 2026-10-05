import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    head: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    subtitle: {
      flexShrink: 1,
      flexBasis: 160,
      flexGrow: 1,
    },
    card: {
      gap: theme.spacing.base,
      padding: theme.spacing.base,
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
    },
  });
}
