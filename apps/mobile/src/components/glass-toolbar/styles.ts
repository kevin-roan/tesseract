import { StyleSheet } from "react-native";

import { squareButtonLook } from "@/components/icon-button/styles";
import { ControlHeight, Opacity, type Theme } from "@/theme";

/** Enough for a short title and the connection dot before the actions start scrolling. */
const TITLE_MIN_WIDTH = 112;

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
      minWidth: TITLE_MIN_WIDTH,
      paddingHorizontal: theme.spacing.xs,
    },
    actions: {
      flexGrow: 0,
      flexShrink: 1,
    },
    actionsContent: {
      alignItems: "center",
      gap: theme.spacing.xxs,
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
