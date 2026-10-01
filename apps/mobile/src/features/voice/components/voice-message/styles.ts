import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    message: {
      alignItems: "flex-end",
      gap: theme.spacing.xs,
    },
    caption: {
      maxWidth: theme.maxBubbleWidth,
      paddingHorizontal: theme.spacing.md,
      textAlign: "right",
    },
  });
}
