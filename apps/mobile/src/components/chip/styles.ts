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
      borderColor: theme.colors.accentStrong,
      backgroundColor: theme.colors.accentMuted,
    },
    label: {
      flexShrink: 1,
    },
    ghost: {
      flexShrink: 1,
      paddingHorizontal: theme.spacing.sm,
      borderColor: "transparent",
      backgroundColor: "transparent",
    },
    pressed: {
      opacity: 0.8,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
