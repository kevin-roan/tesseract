import { StyleSheet } from "react-native";

import { BorderWidth, ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      minHeight: ControlHeight.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceElevated,
    },
    selected: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accentMuted,
    },
    pressed: {
      opacity: 0.8,
    },
  });
}
