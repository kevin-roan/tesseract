import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

const THUMB = 72;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    preview: {
      gap: theme.spacing.sm,
      padding: theme.spacing.base,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surfaceSunken,
    },
    thumbs: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.backgroundElement,
    },
  });
}
