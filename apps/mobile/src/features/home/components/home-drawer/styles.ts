import { StyleSheet } from "react-native";

import { ControlHeight, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    title: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.base,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.xl,
    },
    group: {
      gap: theme.spacing.xxs,
    },
    groupTitle: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.xs,
    },
    allChats: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      minHeight: ControlHeight.lg,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderCurve: "continuous",
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.divider,
    },
    newChat: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      minHeight: ControlHeight.lg,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      backgroundColor: theme.colors.accent,
    },
  });
}
