import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    tray: {
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
    },
  });
}
