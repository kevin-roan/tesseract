import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    section: {
      gap: theme.spacing.md,
    },
    loading: {
      alignItems: "flex-start",
      paddingVertical: theme.spacing.sm,
    },
    empty: {
      gap: theme.spacing.md,
      alignItems: "flex-start",
    },
  });
}
