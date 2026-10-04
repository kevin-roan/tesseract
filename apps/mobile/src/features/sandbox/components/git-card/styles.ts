import { StyleSheet } from "react-native";

import { iconTileSize } from "@/components/resource-card/styles";
import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    tree: {
      marginLeft: iconTileSize(theme) / 2,
      paddingVertical: theme.spacing.xxs,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: theme.colors.borderStrong,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    branch: {
      width: theme.spacing.md,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.borderStrong,
    },
    figure: {
      fontVariant: ["tabular-nums"],
    },
    code: {
      minWidth: theme.spacing.xl,
      flexShrink: 0,
    },
    grow: {
      flex: 1,
      minWidth: 0,
    },
  });
}
