import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

import { ActionButtonColors, type ActionButtonVariant } from "./variants";

export default function createStyles(theme: Theme, variant: ActionButtonVariant, size: "sm" | "md", stretch: boolean) {
  const compact = size === "sm";

  return StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: stretch ? "stretch" : "flex-start",
      gap: theme.spacing.xs,
      minHeight: compact ? ControlHeight.sm : ControlHeight.lg,
      paddingHorizontal: compact ? theme.spacing.md : theme.spacing.xl,
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
      backgroundColor: theme.colors[ActionButtonColors[variant].background],
    },
    pressed: {
      opacity: 0.8,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
