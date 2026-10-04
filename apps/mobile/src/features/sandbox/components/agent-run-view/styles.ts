import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.spacing.lg,
    },
    turn: {
      paddingTop: theme.spacing.base,
    },
    footer: {
      gap: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    activity: {
      alignSelf: "stretch",
    },
    brief: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    briefText: {
      textAlign: "center",
      fontVariant: ["tabular-nums"],
    },
  });
}
