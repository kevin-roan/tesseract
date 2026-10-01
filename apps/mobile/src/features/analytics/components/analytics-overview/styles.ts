import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const STALE_OPACITY = 0.5;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    overview: {
      gap: theme.sectionGap,
    },
    stale: {
      opacity: STALE_OPACITY,
    },
    lead: {
      gap: theme.spacing.base,
    },
  });
}
