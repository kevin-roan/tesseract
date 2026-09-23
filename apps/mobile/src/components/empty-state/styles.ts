import { StyleSheet } from "react-native";

import { AvatarSize, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const badge = AvatarSize.xl;

  return StyleSheet.create({
    container: {
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.lg,
      paddingVertical: theme.spacing["3xl"],
      paddingHorizontal: theme.spacing.xl,
    },
    iconBadge: {
      width: badge,
      height: badge,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.xl,
      borderCurve: "continuous",
      backgroundColor: theme.colors.accentMuted,
    },
    copy: {
      gap: theme.spacing.sm,
      maxWidth: theme.maxContentWidth,
    },
    centered: {
      textAlign: "center",
    },
  });
}
