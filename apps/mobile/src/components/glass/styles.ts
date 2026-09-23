import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    surface: {
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    pill: {
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
      overflow: "hidden",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    button: {
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
    },
    buttonPressed: {
      transform: [{ scale: 0.97 }],
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
}
