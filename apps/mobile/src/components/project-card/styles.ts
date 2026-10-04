import { StyleSheet } from "react-native";

import { type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const action = theme.isTablet ? 52 : 44;

  return StyleSheet.create({
    card: {
      gap: theme.spacing.base,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.card,
      borderCurve: "continuous",
      overflow: "hidden",
    },

    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    /** Takes the slack so the menu button stays pinned to the right. */
    titles: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    menuButton: {
      alignItems: "center",
      justifyContent: "center",
      width: theme.spacing.xl,
      height: theme.spacing.xl,
      borderRadius: theme.radius.sm,
    },

    metaRow: {
      flexDirection: "row",
      gap: theme.spacing.md,
    },
    /** Equal columns, so the three meta values line up card to card. */
    metaColumn: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    metaValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },

    tagPill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: theme.spacing.xxs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.sm,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
      maxWidth: "100%",
    },

    footer: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    membersPill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingLeft: theme.spacing.xs,
      paddingRight: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    actionButton: {
      width: action,
      height: action,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
      borderCurve: "continuous",
      backgroundColor: theme.colors.accent,
    },

    shrink: {
      flexShrink: 1,
    },
  });
}
