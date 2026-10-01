import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const badge = theme.isTablet ? ControlHeight.lg : ControlHeight.md;

  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
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
      backgroundColor: theme.colors.backgroundElement,
    },
    /** Takes the slack so the trailing figure stays pinned to the right. */
    body: {
      flex: 1,
      minWidth: 0,
    },
    trailing: {
      alignItems: "flex-end",
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
