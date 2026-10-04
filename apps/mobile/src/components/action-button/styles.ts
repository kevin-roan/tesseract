import { StyleSheet } from "react-native";

import { ControlHeight, Opacity, type Theme } from "@/theme";

import { ActionButtonColors, type ActionButtonVariant } from "./variants";

export default function createStyles(theme: Theme, variant: ActionButtonVariant, size: "sm" | "md", stretch: boolean) {
  const compact = size === "sm";
  const outlined = theme.look === "graphite" && variant === "secondary";

  return StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: stretch ? "stretch" : "flex-start",
      gap: theme.spacing.xs,
      minHeight: compact ? ControlHeight.sm : ControlHeight.lg,
      paddingHorizontal: compact ? theme.spacing.md : theme.spacing.xl,
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      backgroundColor: outlined ? "transparent" : theme.colors[ActionButtonColors[variant].background],
      ...(outlined && { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderStrong }),
    },
    disabled: {
      opacity: Opacity.disabled,
    },
  });
}
