import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    form: {
      gap: theme.spacing.md,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
  });
}
