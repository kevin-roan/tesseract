import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

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
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
    },
    label: {
      alignSelf: "stretch",
      textAlign: "center",
    },
    pressed: {
      opacity: 0.85,
      transform: [{ scale: 0.96 }],
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
