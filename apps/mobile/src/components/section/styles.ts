import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    section: {
      gap: theme.spacing.md,
    },
    empty: {
      gap: theme.spacing.md,
      alignItems: "flex-start",
    },
  });
}
