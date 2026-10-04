import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.lg,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.divider,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    titles: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    value: {
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
    track: {
      height: theme.spacing.xs,
      flexDirection: "row",
      overflow: "hidden",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.backgroundSelected,
    },
    bar: {
      height: theme.spacing.xs,
      borderRadius: theme.radius.full,
      transformOrigin: "left",
    },
  });
}
