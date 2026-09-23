import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.sectionGap,
    },
    prompt: {
      gap: theme.spacing.xs,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      backgroundColor: theme.colors.accentMuted,
    },
    footer: {
      gap: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
  });
}
