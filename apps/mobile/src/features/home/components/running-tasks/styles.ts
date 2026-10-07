import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      width: "100%",
      maxWidth: theme.maxContentWidth,
      alignSelf: "center",
      paddingHorizontal: theme.gutter,
      gap: theme.spacing.sm,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xs,
    },
    card: {
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.divider,
    },
    pressed: {
      backgroundColor: theme.colors.backgroundSelected,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
  });
}
