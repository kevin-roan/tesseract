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
      paddingHorizontal: theme.spacing.xs,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    allChats: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    pressed: {
      opacity: 0.7,
    },
    newChat: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      minHeight: ControlHeight.lg,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.accent,
    },
    newChatPressed: {
      backgroundColor: theme.colors.accentPressed,
    },
  });
}
