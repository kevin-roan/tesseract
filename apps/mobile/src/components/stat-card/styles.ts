import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

/** Card floor so a row of stat cards keeps the original footprint. */
const CardMinHeight = { phone: 164, tablet: 184 } as const;

export const iconTileSize = (theme: Theme) => (theme.isTablet ? ControlHeight.lg : ControlHeight.md);

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    /** Fills the grid cell so cards sharing a row end up the same height. */
    card: {
      flex: 1,
      minHeight: theme.isTablet ? CardMinHeight.tablet : CardMinHeight.phone,
      justifyContent: "space-between",
      gap: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
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
  });
}
