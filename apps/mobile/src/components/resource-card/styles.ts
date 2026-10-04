import { StyleSheet } from "react-native";

import { AvatarSize, type Theme } from "@/theme";

export const iconTileSize = (theme: Theme) => (theme.isTablet ? AvatarSize.lg : AvatarSize.md);

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.md,
      padding: theme.spacing.base,
      borderRadius: theme.radius.card,
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
  });
}
