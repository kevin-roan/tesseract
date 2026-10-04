import { StyleSheet } from "react-native";

import { ControlHeight, Opacity, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      minHeight: ControlHeight.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.surfaceElevated,
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
    disabled: {
      opacity: Opacity.disabled,
    },
  });
}
