import { StyleSheet } from "react-native";

import { BorderWidth, ControlHeight, DotSize, Shadows, type Theme } from "@/theme";

export default function createStyles(theme: Theme, bottom: number) {
  /** Height of the pill and the diameter of the round accessory beside it. */
  const barHeight = ControlHeight.xl + theme.spacing.sm;
  const graphite = theme.look === "graphite";
  const lift = graphite ? Shadows.none : Shadows.float;
  const rim = {
    borderRadius: theme.radius.full,
    borderWidth: BorderWidth.thin,
    borderColor: theme.colors.borderStrong,
  };

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
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      width: "100%",
      maxWidth: theme.maxContentWidth,
    },
    float: {
      flex: 1,
      borderRadius: theme.radius.full,
      ...lift,
    },
    glass: {
      ...rim,
      height: barHeight,
      justifyContent: "center",
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.xs,
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
      height: barHeight - theme.spacing.xs * 2,
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
    },
    label: {
      maxWidth: "100%",
    },
    accessoryFloat: {
      width: barHeight,
      height: barHeight,
      borderRadius: theme.radius.full,
      ...lift,
    },
    accessoryGlass: {
      ...rim,
      flex: 1,
    },
    accessoryButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: theme.spacing.md,
      right: theme.spacing.md,
      width: DotSize.md,
      height: DotSize.md,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.danger,
      borderWidth: BorderWidth.thin,
      borderColor: theme.colors.background,
    },
  });
}
