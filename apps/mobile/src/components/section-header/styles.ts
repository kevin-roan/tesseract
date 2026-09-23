import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    title: {
      flexShrink: 1,
    },
    /** Keeps the tap target comfortable without pushing the row taller. */
    action: {
      paddingVertical: theme.spacing.xs,
      paddingLeft: theme.spacing.sm,
    },
    actionPressed: {
      opacity: 0.6,
    },
  });
}
