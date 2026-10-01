import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const badge = theme.isTablet ? ControlHeight.lg : ControlHeight.md;

  return StyleSheet.create({
    /** Fills the grid cell so cards sharing a row end up the same height. */
    card: {
      flex: 1,
      minHeight: theme.isTablet ? 184 : 164,
      justifyContent: "space-between",
      gap: theme.spacing.lg,
      padding: theme.spacing.base,
      borderRadius: theme.radius["2xl"],
      borderCurve: "continuous",
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    iconBadge: {
      width: badge,
      height: badge,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
    },
    bottom: {
      gap: theme.spacing.xs,
    },
    valueRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "baseline",
      columnGap: theme.spacing.xs,
    },
    value: {
      flexShrink: 1,
      fontVariant: ["tabular-nums"],
    },
    unit: {
      flexShrink: 1,
    },
    pressable: {
      flex: 1,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
