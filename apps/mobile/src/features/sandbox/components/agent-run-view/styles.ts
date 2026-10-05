import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.lg,
    },
    footer: {
      gap: theme.spacing.md,
    },
    brief: {
      fontVariant: ["tabular-nums"],
    },
  });
}
