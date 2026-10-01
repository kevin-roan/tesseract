import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export const SPHERE = {
  capsule: { size: 28, dots: 28 },
  card: { size: 112, dots: 96 },
} as const;

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
    capsuleText: {
      flex: 1,
    },
    card: {
      alignItems: "center",
      gap: theme.spacing.base,
      padding: theme.spacing.xl,
      borderRadius: theme.radius.card,
    },
    percentPill: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.backgroundElement,
    },
    collapse: {
      position: "absolute",
      top: theme.spacing.base,
      right: theme.spacing.base,
    },
    copy: {
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    centered: {
      textAlign: "center",
    },
    progress: {
      alignSelf: "stretch",
      gap: theme.spacing.xs,
    },
    actions: {
      flexDirection: "row",
      alignSelf: "stretch",
      gap: theme.spacing.md,
    },
    action: {
      flex: 1,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
  });
}
