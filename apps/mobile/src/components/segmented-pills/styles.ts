import { StyleSheet } from "react-native";

import { ControlHeight, FontWeights, sansFor, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const inset = theme.spacing.xxs;

  return StyleSheet.create({
    row: {
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: inset,
      padding: inset,
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
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      backgroundColor: theme.colors.accent,
    },
    segment: {
      minHeight: ControlHeight.sm,
      minWidth: ControlHeight.sm + theme.spacing.xs,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
    },
    selected: {
      backgroundColor: theme.colors.accent,
    },
    labelSelected: {
      fontFamily: sansFor(FontWeights.medium),
      fontWeight: FontWeights.medium,
    },
  });
}
