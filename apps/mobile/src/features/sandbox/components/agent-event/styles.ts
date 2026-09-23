import { StyleSheet } from "react-native";

import { BorderWidth, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    bubble: {
      alignSelf: "flex-start",
      maxWidth: theme.maxBubbleWidth,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      backgroundColor: theme.colors.bubbleAssistant,
    },
    tool: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.codeBackground,
    },
    toolError: {
      borderColor: theme.colors.danger,
    },
    toolBody: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    system: {
      textAlign: "center",
    },
  });
}
