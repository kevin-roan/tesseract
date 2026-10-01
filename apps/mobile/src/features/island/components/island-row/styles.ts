import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
