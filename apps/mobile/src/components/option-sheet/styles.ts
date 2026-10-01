import { StyleSheet } from "react-native";

import { ControlHeight, displayFor, FontWeights, sansFor, MinTouchTarget, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
    close: {
      width: ControlHeight.sm,
      height: ControlHeight.sm,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.backgroundElement,
    },
    pressed: {
      opacity: 0.7,
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontFamily: displayFor(FontWeights.bold),
    },
    group: {
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      minHeight: MinTouchTarget,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
    },
    rowPressed: {
      backgroundColor: theme.colors.backgroundElement,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: theme.spacing.base,
      backgroundColor: theme.colors.divider,
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    label: {
      flexShrink: 1,
    },
    badge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.badge,
    },
    badgeText: {
      color: theme.colors.badgeText,
      fontFamily: sansFor(FontWeights.medium),
    },
    footnote: {
      paddingHorizontal: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
    },
  });
}
