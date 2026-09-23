import { StyleSheet } from "react-native";

import { ControlHeight, Shadows, type Theme } from "@/theme";

export default function createStyles(theme: Theme, bottomOffset: number) {
  const size = theme.isTablet ? ControlHeight.xl + 8 : ControlHeight.xl;

  return StyleSheet.create({
    fab: {
      position: "absolute",
      right: theme.gutter,
      bottom: bottomOffset,
      width: size,
      height: size,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accent,
      ...Shadows.level3,
    },
    pressed: {
      opacity: 0.85,
      transform: [{ scale: 0.96 }],
    },
  });
}
