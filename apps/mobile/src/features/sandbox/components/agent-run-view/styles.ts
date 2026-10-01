import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.spacing.base,
    },
    turn: {
      paddingTop: theme.spacing.md,
    },
    footer: {
      gap: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    brief: {
      textAlign: "center",
    },
    spinner: {
      alignSelf: "flex-start",
    },
  });
}
