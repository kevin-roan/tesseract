import { StyleSheet } from "react-native";

import { squareButtonLook } from "@/components/icon-button/styles";
import { ControlHeight, Opacity, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const button = ControlHeight.md;
  const graphite = theme.look === "graphite";
  const square = squareButtonLook(theme);

  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xxs,
      padding: theme.spacing.xs,
      borderRadius: theme.radius.pill,
    },
    titles: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: theme.spacing.xs,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    title: {
      flexShrink: 1,
    },
    button: {
      width: button,
      height: button,
      alignItems: "center",
      justifyContent: "center",
      ...(graphite ? square.frame : { borderRadius: theme.radius.full }),
    },
    selected: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    pressed: graphite ? square.pressed : { backgroundColor: theme.colors.backgroundElement },
    disabled: {
      opacity: Opacity.disabled,
    },
  });
}
