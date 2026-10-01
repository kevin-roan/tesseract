import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const SPHERE = { size: 28, dots: 28 } as const;

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    capsule: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.base,
      borderRadius: theme.radius.full,
    },
    title: {
      flex: 1,
    },
    pill: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.backgroundElement,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
  });
}
