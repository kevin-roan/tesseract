import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    user: {
      alignItems: "flex-end",
      gap: theme.spacing.xs,
    },
    userBubble: {
      maxWidth: theme.maxBubbleWidth,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bubbleUser,
    },
    userTime: {
      paddingHorizontal: theme.spacing.xs,
      fontVariant: ["tabular-nums"],
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
    time: {
      fontVariant: ["tabular-nums"],
    },
  });
}
