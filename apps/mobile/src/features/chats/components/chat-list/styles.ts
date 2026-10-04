import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    skeletons: {
      gap: theme.spacing.md,
      padding: theme.spacing.base,
    },
  });
}
