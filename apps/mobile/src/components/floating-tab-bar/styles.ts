import { StyleSheet } from "react-native";

import { BorderWidth, ControlHeight, DotSize, Shadows, type Theme } from "@/theme";

/** Height of the pill and the diameter of the round accessory beside it. */
export const TAB_BAR_HEIGHT = ControlHeight.lg;

export default function createStyles(theme: Theme, bottom: number) {
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
      height: TAB_BAR_HEIGHT,
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
      height: TAB_BAR_HEIGHT - theme.spacing.xs * 2,
      borderRadius: theme.radius.full,
      borderCurve: "continuous",
    },
    accessoryFloat: {
      width: TAB_BAR_HEIGHT,
      height: TAB_BAR_HEIGHT,
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
