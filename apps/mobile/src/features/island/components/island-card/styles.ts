import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.base,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.card,
    },
    body: {
      gap: theme.spacing.base,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    action: {
      flex: 1,
    },
  });
}
