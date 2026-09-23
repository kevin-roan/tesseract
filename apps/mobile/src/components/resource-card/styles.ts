import { StyleSheet } from "react-native";

import { AvatarSize, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const badge = theme.isTablet ? AvatarSize.lg : AvatarSize.md;

  return StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    summary: {
      gap: theme.spacing.sm,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
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
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    footer: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}
