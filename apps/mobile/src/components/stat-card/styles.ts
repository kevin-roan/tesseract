import { StyleSheet } from "react-native";

import { Shadows, type Theme } from "@/theme";

/** Diameter of the corner progress ring, per device size. */
export const RingSize = { md: 40, lg: 48 } as const;

export default function createStyles(theme: Theme, featured: boolean) {
  const badge = theme.isTablet ? 44 : 38;

  return StyleSheet.create({
    /** Fills the grid cell so cards sharing a row end up the same height. */
    card: {
      flex: 1,
      minHeight: theme.isTablet ? 168 : 148,
      justifyContent: "space-between",
      gap: theme.spacing.lg,
      padding: theme.spacing.base,
      borderRadius: theme.radius.xl,
      borderCurve: "continuous",
      overflow: "hidden",
      ...(featured && {
        backgroundColor: theme.colors.accent,
        ...Shadows.level1,
      }),
    },
    top: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    /**
     * Rounded square behind the icon. On the accent card it is a deeper wash of
     * the accent rather than a light surface, which would blow out next to it.
     */
    iconBadge: {
      width: badge,
      height: badge,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      backgroundColor: featured
        ? theme.colors.accentPressed
        : theme.colors.surfaceElevated,
    },
    bottom: {
      gap: theme.spacing.xxs,
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: theme.spacing.xxs,
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
