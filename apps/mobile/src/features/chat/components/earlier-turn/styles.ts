import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    turn: {
      gap: theme.spacing.lg,
    },
  });
}
