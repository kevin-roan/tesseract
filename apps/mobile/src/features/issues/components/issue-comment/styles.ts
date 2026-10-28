import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    comment: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    avatar: {
      width: theme.spacing.xl,
      alignItems: "center",
      paddingTop: theme.spacing.xxs,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    author: {
      flex: 1,
    },
    card: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
  });
}
