import { StyleSheet } from "react-native";

import { BorderWidth, ControlHeight, Shadows, type Theme } from "@/theme";

export default function createStyles(theme: Theme, bottom: number) {
  const graphite = theme.look === "graphite";

  return StyleSheet.create({
    routes: {
      display: "none",
    },
    root: {
      flex: 1,
    },
    slot: {
      flex: 1,
    },
    dock: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom,
      alignItems: "center",
      paddingHorizontal: theme.gutter,
    },
    float: {
      width: "100%",
      maxWidth: theme.maxContentWidth,
      borderRadius: theme.radius.full,
      ...(graphite ? Shadows.none : Shadows.float),
    },
    glass: {
      borderRadius: theme.radius.full,
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.borderStrong,
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.spacing.xs,
    },
    indicator: {
      position: "absolute",
      top: theme.spacing.xs,
      bottom: theme.spacing.xs,
      left: 0,
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
      backgroundColor: theme.colors.backgroundSelected,
      borderWidth: graphite ? StyleSheet.hairlineWidth : 0,
      borderColor: theme.colors.border,
    },
    button: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xxs,
      minHeight: ControlHeight.xl,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
    },
  });
}
