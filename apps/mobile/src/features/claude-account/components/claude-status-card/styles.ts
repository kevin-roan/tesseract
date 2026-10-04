import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    rows: {
      marginTop: theme.spacing.xs,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.divider,
    },
    row: {
      paddingVertical: theme.spacing.md,
    },
  });
}
