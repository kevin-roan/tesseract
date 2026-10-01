import { StyleSheet } from "react-native";

import { ControlHeight, MinTouchTarget, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      minHeight: MinTouchTarget,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
    },
    selected: {
      backgroundColor: theme.colors.accentMuted,
    },
    pressed: {
      backgroundColor: theme.colors.backgroundElement,
    },
    icon: {
      width: ControlHeight.md,
      height: ControlHeight.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.accentMuted,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
  });
}
