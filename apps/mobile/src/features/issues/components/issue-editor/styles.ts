import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    editor: {
      gap: theme.spacing.md,
    },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    title: {
      ...theme.text.h3,
      color: theme.colors.text,
      padding: 0,
    },
    description: {
      gap: theme.spacing.sm,
    },
    descriptionBody: {
      paddingVertical: theme.spacing.xs,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: theme.spacing.sm,
    },
  });
}
