import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    user: {
      alignItems: "flex-end",
      gap: theme.spacing.xs,
    },
    userBubble: {
      maxWidth: theme.maxBubbleWidth,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.xl,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
    userTime: {
      paddingHorizontal: theme.spacing.xs,
    },
    assistant: {
      alignItems: "stretch",
      gap: theme.spacing.sm,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    meta: {
      flexShrink: 1,
      flexDirection: "row",
      alignItems: "baseline",
      gap: theme.spacing.sm,
    },
  });
}
