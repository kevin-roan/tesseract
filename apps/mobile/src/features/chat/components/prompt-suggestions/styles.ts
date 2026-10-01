import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    scroll: {
      flexGrow: 0,
      marginHorizontal: -theme.gutter,
    },
    content: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.gutter,
    },
    card: {
      width: theme.spacing["6xl"] * 2,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      backgroundColor: theme.colors.backgroundElement,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
