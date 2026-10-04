import { StyleSheet } from "react-native";

import { ControlHeight, Opacity, Shadows, type Theme } from "@/theme";

export default function createStyles(theme: Theme, bottomOffset: number) {
  const size = theme.isTablet ? ControlHeight.xl + theme.spacing.sm : ControlHeight.xl;
  const graphite = theme.look === "graphite";

  return StyleSheet.create({
    fab: {
      position: "absolute",
      right: theme.gutter,
      bottom: bottomOffset,
      width: size,
      height: size,
      borderRadius: graphite ? theme.radius.card : theme.radius.full,
      borderCurve: "continuous",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accent,
      ...(graphite ? Shadows.none : Shadows.level3),
    },
    pressed: {
      opacity: Opacity.pressedSoft,
    },
  });
}
