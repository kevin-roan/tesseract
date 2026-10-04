import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    list: {
      gap: theme.spacing.sm,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.divider,
    },
  });
}
