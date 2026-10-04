import { StyleSheet } from "react-native";

import { squareButtonLook } from "@/components/icon-button/styles";
import { Opacity, Shadows, type SurfaceGlass, type Theme } from "@/theme";

export default function createStyles(theme: Theme, glass: SurfaceGlass, nested: boolean) {
  const graphite = theme.look === "graphite";
  const square = squareButtonLook(theme);

  return StyleSheet.create({
    glass: {
      borderRadius: graphite ? theme.radius.card : theme.radius.lg,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    frosted: {
      backgroundColor: glass.fill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: glass.border,
    },
    flat: {
      backgroundColor: nested ? theme.colors.backgroundElement : theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    float: {
      borderRadius: graphite ? square.frame.borderRadius : theme.radius.pill,
      ...(graphite ? Shadows.none : Shadows.float),
    },
    button: {
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      ...(graphite && square.frame),
    },
    pressed: graphite ? square.pressed : {},
    disabled: {
      opacity: Opacity.disabled,
    },
  });
}
