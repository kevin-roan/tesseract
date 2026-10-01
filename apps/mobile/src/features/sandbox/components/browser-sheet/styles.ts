import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    current: {
      gap: theme.spacing.xs,
    },
    field: {
      gap: theme.spacing.xxs,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    others: {
      gap: theme.spacing.xs,
    },
  });
}
