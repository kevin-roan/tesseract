import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export const iconTileSize = (theme: Theme) => (theme.isTablet ? ControlHeight.lg : ControlHeight.md);

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    /** Takes the slack so the trailing figure stays pinned to the right. */
    body: {
      flex: 1,
      minWidth: 0,
    },
    trailing: {
      alignItems: "flex-end",
    },
    figure: {
      fontVariant: ["tabular-nums"],
    },
  });
}
