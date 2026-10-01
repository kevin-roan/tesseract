import { StyleSheet } from "react-native";

import type { Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.card,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    title: {
      flex: 1,
    },
    preview: {
      marginBottom: theme.spacing.xxs,
    },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    project: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.backgroundElement,
      maxWidth: "60%",
    },
    projectLabel: {
      flexShrink: 1,
    },
    active: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.successMuted,
    },
    dot: {
      width: theme.spacing.xs + 2,
      height: theme.spacing.xs + 2,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.successSolid,
    },
    spacer: {
      flex: 1,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
  });
}
