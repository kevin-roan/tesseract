import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bubbleUser,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    author: {
      flexShrink: 1,
    },
    time: {
      marginLeft: "auto",
      fontVariant: ["tabular-nums"],
    },
  });
}
