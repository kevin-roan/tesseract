import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    surface: {
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    pill: {
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
      overflow: "hidden",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      backgroundColor: theme.colors.backgroundElement,
    },
    button: {
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
    },
    buttonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
}
