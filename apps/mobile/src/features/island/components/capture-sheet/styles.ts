import { StyleSheet } from "react-native";

import { Shadows, type Theme } from "@/theme";

import { ISLAND_PANEL_MAX_WIDTH, ISLAND_PANEL_RADIUS } from "../../utils/constants";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: theme.spacing.sm,
    },
    scrim: {
      ...StyleSheet.absoluteFill,
    },
    card: {
      width: "100%",
      maxWidth: ISLAND_PANEL_MAX_WIDTH,
      paddingTop: theme.spacing.sm,
      borderRadius: ISLAND_PANEL_RADIUS,
      borderCurve: "continuous",
      backgroundColor: theme.colors.surfaceSunken,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderStrong,
      transformOrigin: "top",
      ...Shadows.level3,
    },
    header: {
      paddingLeft: theme.spacing.base,
      paddingRight: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
    expanded: {
      flex: 1,
    },
    content: {
      gap: theme.spacing.base,
      paddingHorizontal: theme.spacing.base,
      paddingBottom: theme.spacing.base,
    },
  });
}
