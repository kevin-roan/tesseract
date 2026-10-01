import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    rows: {
      gap: theme.spacing.xs,
    },
  });
}
