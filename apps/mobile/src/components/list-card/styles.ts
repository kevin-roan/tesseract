import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const badge = theme.isTablet ? 52 : 44;

  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    iconBadge: {
      width: badge,
      height: badge,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
      backgroundColor: theme.colors.surfaceElevated,
    },
    /** Takes the slack so the trailing figure stays pinned to the right. */
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    trailing: {
      alignItems: "flex-end",
      gap: theme.spacing.xxs,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
