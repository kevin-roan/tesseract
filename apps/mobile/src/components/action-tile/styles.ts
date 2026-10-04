import { StyleSheet } from "react-native";

import { ControlHeight, Opacity, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const bubble = theme.isTablet ? ControlHeight.xl + theme.spacing.base : ControlHeight.xl + theme.spacing.sm;

  return StyleSheet.create({
    tile: {
      flex: 1,
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    bubbleSlot: {
      width: bubble,
      height: bubble,
    },
    bubble: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
    },
    plain: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    label: {
      alignSelf: "stretch",
      textAlign: "center",
    },
    disabled: {
      opacity: Opacity.disabled,
    },
  });
}
