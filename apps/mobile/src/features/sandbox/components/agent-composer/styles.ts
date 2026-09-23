import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    composer: {
      gap: theme.spacing.base,
    },
    projects: {
      gap: theme.spacing.xs,
    },
  });
}
