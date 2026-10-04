import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    body: {
      flex: 1,
      gap: theme.spacing.base,
      paddingHorizontal: theme.gutter,
      paddingBottom: theme.spacing.base,
    },
    fill: {
      flex: 1,
    },
    log: {
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceSunken,
    },
  });
}
