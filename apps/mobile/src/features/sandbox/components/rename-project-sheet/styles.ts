import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    actions: {
      gap: theme.spacing.sm,
    },
  });
}
