import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    guide: {
      gap: theme.spacing.xl,
    },
    mode: {
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
  });
}
