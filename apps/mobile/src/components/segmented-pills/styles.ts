import { StyleSheet } from "react-native";

import { ControlHeight, FontWeights, sansFor, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const inset = theme.spacing.xxs;

  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: inset,
      padding: inset,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    rowFill: {
      flexGrow: 1,
    },
    scroller: {
      flexGrow: 0,
    },
    scrollContent: {
      flexGrow: 1,
    },
    indicator: {
      position: "absolute",
      top: inset,
      bottom: inset,
      left: 0,
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
      backgroundColor: theme.colors.backgroundSelected,
    },
    segment: {
      minHeight: ControlHeight.sm,
      minWidth: ControlHeight.sm + theme.spacing.xs,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
    },
    selected: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    labelSelected: {
      fontFamily: sansFor(FontWeights.medium),
      fontWeight: FontWeights.medium,
    },
  });
}
