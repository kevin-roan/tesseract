import { StyleSheet } from "react-native";

import { Shadows, type SurfaceGlass, type Theme } from "@/theme";

export default function createStyles(theme: Theme, glass: SurfaceGlass) {
  return StyleSheet.create({
    glass: {
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    frosted: {
      backgroundColor: glass.fill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: glass.border,
    },
    float: {
      borderRadius: theme.radius.pill,
      ...Shadows.float,
    },
    button: {
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      transform: [{ scale: 0.95 }],
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
