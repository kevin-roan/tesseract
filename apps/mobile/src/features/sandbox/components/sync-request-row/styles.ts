import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    conflicts: {
      gap: theme.spacing.xxs,
    },
  });
}
