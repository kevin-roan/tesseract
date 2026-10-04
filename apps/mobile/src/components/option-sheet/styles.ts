import { StyleSheet } from "react-native";

import { ControlHeight, displayFor, FontWeights, sansFor, MinTouchTarget, type Theme } from "@/theme";

export default function createStyles(theme: Theme) {
  const graphite = theme.look === "graphite";

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
      borderRadius: graphite ? theme.radius.md : theme.radius.full,
      borderCurve: "continuous",
      borderWidth: graphite ? StyleSheet.hairlineWidth : 0,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElement,
    },
    title: {
      flex: 1,
      textAlign: "center",
      ...(graphite ? null : { fontFamily: displayFor(FontWeights.bold) }),
    },
    group: {
      borderRadius: theme.radius.card,
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
      borderRadius: graphite ? theme.radius.sm : theme.radius.full,
      borderCurve: "continuous",
      borderWidth: graphite ? StyleSheet.hairlineWidth : 0,
      borderColor: theme.colors.border,
      backgroundColor: graphite ? theme.colors.backgroundSelected : theme.colors.badge,
    },
    badgeText: {
      ...(graphite ? null : { color: theme.colors.badgeText, fontFamily: sansFor(FontWeights.medium) }),
    },
    footnote: {
      paddingHorizontal: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
    },
  });
}
