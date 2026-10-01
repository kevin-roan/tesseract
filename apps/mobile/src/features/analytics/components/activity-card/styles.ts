import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    stack: {
      gap: theme.spacing.md,
    },
  });
}
